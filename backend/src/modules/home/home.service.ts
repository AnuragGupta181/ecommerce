import { listLiveBanners } from "../banners/banners.service.js";
import { getCategoryTree } from "../categories/categories.service.js";
import type { Point } from "../geo/geo.js";
import { nearbyShops } from "../branches/branch.service.js";
import { prisma } from "../../lib/prisma.js";
import { loadOffers } from "../listings/offers.service.js";
import { cardsFromOffers, variantIdsOf } from "../products/products.presenter.js";
import { productRailRows } from "../products/products.service.js";
import { wishlistedIds } from "../wishlist/wishlist.service.js";
import { listPublicPlans } from "../subscriptions/plans.service.js";

const UNDER_PRICE = 49_900;
const NEW_ARRIVAL_DAYS = 30;

/**
 * Everything the home screen needs in one round trip.
 * Each rail carries the listing query that its "See all" button opens.
 */
export async function getHomeFeed(userId?: string, point: Point | null = null) {
  const newSince = new Date(Date.now() - NEW_ARRIVAL_DAYS * 24 * 60 * 60 * 1000);

  const groceryFilter = {
    category: {
      OR: [
        { slug: { in: ["vegetables", "fruits", "dairy-bakery", "atta-rice-dal", "oil-masala", "snacks-beverages", "daily-essentials", "grocery"] } },
        { parent: { slug: "grocery" } },
      ],
    },
  };
  const medicineFilter = {
    category: {
      OR: [
        { slug: { in: ["pain-relief", "cold-cough-fever", "digestive-care", "vitamins-supplements", "first-aid", "diabetes-care", "medicines"] } },
        { parent: { slug: "medicines" } },
      ],
    },
  };

  type Where = Parameters<typeof productRailRows>[0];
  type OrderBy = Parameters<typeof productRailRows>[1];
  const specs: { key: string; title: string; where: Where; orderBy: OrderBy; query: Record<string, string | number> }[] = [
    { key: "fresh_groceries", title: "Fresh Groceries & Vegetables", where: groceryFilter, orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }], query: { category: "grocery", sort: "popular" } },
    { key: "medicines_wellness", title: "Medicines & Daily Wellness", where: medicineFilter, orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }], query: { category: "medicines", sort: "popular" } },
    { key: "deals", title: "Deals of the day", where: { discountPercent: { gte: 20 } }, orderBy: [{ discountPercent: "desc" }, { soldCount: "desc" }], query: { sort: "discount", discount: 20 } },
    { key: "bestsellers", title: "Bestsellers", where: {}, orderBy: [{ soldCount: "desc" }], query: { sort: "popular" } },
    { key: "top_rated", title: "Top rated", where: { ratingCount: { gt: 0 } }, orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }], query: { sort: "rating", rating: 4 } },
    { key: "new", title: "New arrivals", where: { createdAt: { gte: newSince } }, orderBy: [{ createdAt: "desc" }], query: { sort: "newest" } },
    { key: "budget", title: "Daily Essentials Under ₹499", where: { minPrice: { lte: UNDER_PRICE } }, orderBy: [{ soldCount: "desc" }], query: { maxPrice: UNDER_PRICE, sort: "popular" } },
  ];

  // Round 1: every list at once. Round 2: one wishlist and one offers query shared by all rails,
  // instead of three dependent queries per rail.
  const [plans, shops, banners, categories, railRows] = await Promise.all([
    listPublicPlans(point, { page: 1, limit: 10 }),
    nearbyShops(point, 10),
    listLiveBanners(),
    getCategoryTree(),
    Promise.all(specs.map((spec) => productRailRows(spec.where, spec.orderBy, 10))),
  ]);
  const allRows = railRows.flat();
  const [wishlisted, byVariant] = await Promise.all([wishlistedIds(userId, [...new Set(allRows.map((row) => row.id))]), loadOffers(prisma, [...new Set(variantIdsOf(allRows))], point)]);
  const rails = specs
    .map((spec, index) => ({ key: spec.key, title: spec.title, items: cardsFromOffers(railRows[index] ?? [], wishlisted, byVariant), query: spec.query }))
    .filter((rail) => rail.items.length > 0);

  return {
    banners: {
      carousel: banners.filter((banner) => banner.placement === "HOME_CAROUSEL"),
      strip: banners.filter((banner) => banner.placement === "HOME_STRIP"),
    },
    categories: categories.map(({ children: _children, ...category }) => category),
    rails,
    /** Subscription plans (milk, vegetables …) from shops that deliver here. */
    dailyEssentials: plans.items.filter((plan) => plan.shop.deliverable),
    shops,
  };
}
