import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { api, createUserSession, unique } from "../helpers.js";

type Session = Awaited<ReturnType<typeof createUserSession>>;

let admin: Session;
let customer: Session;
let categoryId: string;
let brandId: string;
let brandSlug: string;

beforeAll(async () => {
  admin = await createUserSession("ADMIN");
  customer = await createUserSession();
  const category = await api().post("/api/v1/admin/categories").set(admin.auth).send({ name: unique("Gadgets ") });
  categoryId = category.body.data.id;
  const brand = await api().post("/api/v1/admin/brands").set(admin.auth).send({ name: unique("Acme ") });
  brandId = brand.body.data.id;
  brandSlug = brand.body.data.slug;
});

afterAll(() => prisma.$disconnect());

const productBody = (overrides: Record<string, unknown> = {}) => ({
  name: unique("Wireless Earbuds "),
  description: "Great sound",
  highlights: ["20h battery"],
  specs: [{ label: "Bluetooth", value: "5.3" }],
  tags: ["audio"],
  categoryId,
  brandId,
  images: [{ url: "https://example.com/a.webp" }],
  variants: [
    { sku: unique("SKU-B-"), label: "Black", attributes: { color: "Black" }, mrp: 299_900, price: 199_900, stock: 10 },
    { sku: unique("SKU-W-"), label: "White", attributes: { color: "White" }, mrp: 299_900, price: 179_900, stock: 0 },
  ],
  ...overrides,
});

describe("catalog admin + public browsing", () => {
  it("guards admin endpoints", async () => {
    expect((await api().post("/api/v1/admin/products").send(productBody())).status).toBe(401);
    expect((await api().post("/api/v1/admin/products").set(customer.auth).send(productBody())).status).toBe(403);
  });

  it("validates product input", async () => {
    const res = await api()
      .post("/api/v1/admin/products")
      .set(admin.auth)
      .send(productBody({ variants: [{ sku: "X1", mrp: 100, price: 200 }] }));
    expect(res.status).toBe(422);
  });

  it("creates a product with variants, computes listing price and logs initial stock", async () => {
    const res = await api().post("/api/v1/admin/products").set(admin.auth).send(productBody());
    expect(res.status).toBe(201);
    const product = res.body.data;
    expect(product).toMatchObject({ minPrice: 179_900, minMrp: 299_900, discountPercent: 40 });
    expect(product.variants).toHaveLength(2);

    const movements = await prisma.stockMovement.findMany({ where: { variantId: product.variants[0].id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ type: "IN", quantity: 10, stockAfter: 10 });
  });

  it("lists, filters and shows product detail to guests", async () => {
    const created = await api().post("/api/v1/admin/products").set(admin.auth).send(productBody());
    const { slug } = created.body.data;

    const list = await api().get(`/api/v1/products?brand=${brandSlug}&sort=price_asc`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(list.body.data[0]).toMatchObject({ brand: expect.any(String), inStock: true, isWishlisted: false });

    const detail = await api().get(`/api/v1/products/${slug}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.variants).toHaveLength(2);
    expect(detail.body.data.variants[1]).toMatchObject({ inStock: false, stock: 0 });
    expect(detail.body.data.rating.breakdown).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

    const suggestions = await api().get(`/api/v1/products/suggestions?q=earbuds`);
    expect(suggestions.body.data.products.length).toBeGreaterThan(0);
  });

  it("updates variants, keeps stock untouched and recomputes price", async () => {
    const created = (await api().post("/api/v1/admin/products").set(admin.auth).send(productBody())).body.data;
    const [black] = created.variants;
    const res = await api()
      .patch(`/api/v1/admin/products/${created.id}`)
      .set(admin.auth)
      .send({ variants: [{ id: black.id, sku: black.sku, label: "Black", mrp: 299_900, price: 249_900, stock: 999 }] });

    expect(res.status).toBe(200);
    expect(res.body.data.variants).toHaveLength(1);
    expect(res.body.data.variants[0]).toMatchObject({ price: 249_900, stock: 10 });
    expect(res.body.data.minPrice).toBe(249_900);
  });

  it("adjusts inventory with an audit trail and refuses negative stock", async () => {
    const created = (await api().post("/api/v1/admin/products").set(admin.auth).send(productBody())).body.data;
    const variantId = created.variants[0].id;
    const adjust = (body: object) => api().post(`/api/v1/admin/inventory/variants/${variantId}/adjust`).set(admin.auth).send(body);

    expect((await adjust({ mode: "IN", quantity: 5, reason: "Restock" })).body.data.stock).toBe(15);
    expect((await adjust({ mode: "OUT", quantity: 3, reason: "Damaged" })).body.data.stock).toBe(12);
    expect((await adjust({ mode: "SET", quantity: 4, reason: "Stock count" })).body.data.stock).toBe(4);
    const tooMany = await adjust({ mode: "OUT", quantity: 10, reason: "Oops" });
    expect(tooMany.status).toBe(409);

    const history = await api().get(`/api/v1/admin/inventory/variants/${variantId}/movements`).set(admin.auth);
    expect(history.body.data.map((m: { type: string }) => m.type)).toEqual(["SET", "OUT", "IN", "IN"]);

    const low = await api().get(`/api/v1/admin/inventory?status=low&q=${created.variants[0].sku}`).set(admin.auth);
    expect(low.body.data).toHaveLength(1);
  });

  it("deletes products without orders and blocks deleting categories in use", async () => {
    const created = (await api().post("/api/v1/admin/products").set(admin.auth).send(productBody())).body.data;
    const del = await api().delete(`/api/v1/admin/products/${created.id}`).set(admin.auth);
    expect(del.body.data).toEqual({ archived: false });
    expect((await api().get(`/api/v1/products/${created.slug}`)).status).toBe(404);

    expect((await api().delete(`/api/v1/admin/categories/${categoryId}`).set(admin.auth)).status).toBe(409);
  });
});
