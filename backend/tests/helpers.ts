import request from "supertest";
import { createApp } from "../src/app.js";
import type { Role } from "../src/generated/prisma/enums.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

export const app = createApp();
export const api = () => request(app);

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export const TEST_PASSWORD = "Passw0rd!";

/** Creates a user directly in the DB and logs in through the API. */
export async function createUserSession(role: Role = "CUSTOMER") {
  const email = `${unique("user")}@test.local`;
  const phone = `+919${String(Date.now() + counter).slice(-9)}`;
  await prisma.user.create({
    data: { name: role === "ADMIN" ? "Test Admin" : "Test Customer", email, phone, role, passwordHash: await hashPassword(TEST_PASSWORD) },
  });
  const res = await api().post("/api/v1/auth/login").send({ identifier: email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  const { user, accessToken, refreshToken } = res.body.data as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
  return { user, accessToken, refreshToken, auth: { Authorization: `Bearer ${accessToken}` } };
}

/** Connaught Place, New Delhi: test shops and addresses sit here so delivery is in range. */
export const TEST_POINT = { lat: 28.6315, lng: 77.2167 };

/** An approved vendor with one shop at TEST_POINT and a logged-in owner. */
export async function createVendorSession(overrides: { deliveryRatePerKm?: number; minDeliveryFee?: number; freeDeliveryAbove?: number | null } = {}) {
  const slug = unique("shop-");
  const vendor = await prisma.vendor.create({
    data: { slug, shopName: unique("Test Shop "), phone: "+919800011111", email: `${slug}@test.local`, address: "1 Test Market", status: "APPROVED", commissionBps: 1000, subscriptionsEnabled: true, approvedAt: new Date() },
  });
  const branch = await prisma.branch.create({
    data: {
      vendorId: vendor.id,
      name: "Main",
      slug,
      address: "1 Test Market",
      city: "New Delhi",
      state: "Delhi",
      pincode: "110001",
      ...TEST_POINT,
      deliveryRadiusKm: 10,
      deliveryRatePerKm: overrides.deliveryRatePerKm ?? 1000,
      minDeliveryFee: overrides.minDeliveryFee ?? 2000,
      freeDeliveryAbove: overrides.freeDeliveryAbove === undefined ? 50_000 : overrides.freeDeliveryAbove,
    },
  });
  const email = `${unique("owner")}@test.local`;
  await prisma.user.create({
    data: { name: "Test Vendor", email, phone: `+918${String(Date.now() + counter).slice(-9)}`, role: "VENDOR", vendorId: vendor.id, vendorRole: "OWNER", passwordHash: await hashPassword(TEST_PASSWORD) },
  });
  const res = await api().post("/api/v1/auth/login").send({ identifier: email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Vendor login failed: ${JSON.stringify(res.body)}`);
  return { vendorId: vendor.id, branchId: branch.id, auth: { Authorization: `Bearer ${res.body.data.accessToken as string}` } };
}

/** Lists a catalog variant at a vendor's shop through the vendor API; returns the listing id. */
export async function listAtShop(vendor: { branchId: string; auth: Record<string, string> }, variantId: string, terms: { price: number; mrp: number; stock: number; costPrice?: number }) {
  const res = await api().post("/api/v1/vendor/listings").set(vendor.auth).send({ branchId: vendor.branchId, variantId, ...terms });
  if (res.status !== 201) throw new Error(`Listing failed: ${JSON.stringify(res.body)}`);
  return res.body.data.id as string;
}
