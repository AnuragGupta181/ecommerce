import { listLiveBanners } from "../banners/banners.service.js";
import { getCategoryTree } from "../categories/categories.service.js";
import type { Point } from "../geo/geo.js";
import { nearbyShops } from "../branches/branch.service.js";
import { productRail } from "../products/products.service.js";
import { listPublicPlans } from "../subscriptions/plans.service.js";

const UNDER_PRICE = 49_900;
const NEW_ARRIVAL_DAYS = 30;

/**
 * Everything the home screen needs in one round trip.
 * Each rail carries the listing query that its "See all" button opens.
 */
export async function getHomeFeed(userId?: string, point: Point | null = null) {
  const rail = (where: Parameters<typeof productRail>[0], orderBy: Parameters<typeof productRail>[1]) => productRail(where, orderBy, userId, 10, point);
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

  const [plans, shops, banners, categories, freshGroceries, medicinesWellness, deals, bestsellers, topRated, newArrivals, budget] = await Promise.all([
    listPublicPlans(point, { page: 1, limit: 10 }),
    nearbyShops(point, 10),
    listLiveBanners(),
    getCategoryTree(),
    rail(groceryFilter, [{ soldCount: "desc" }, { ratingAvg: "desc" }]),
    rail(medicineFilter, [{ soldCount: "desc" }, { ratingAvg: "desc" }]),
    rail({ discountPercent: { gte: 20 } }, [{ discountPercent: "desc" }, { soldCount: "desc" }]),
    rail({}, [{ soldCount: "desc" }]),
    rail({ ratingCount: { gt: 0 } }, [{ ratingAvg: "desc" }, { ratingCount: "desc" }]),
    rail({ createdAt: { gte: newSince } }, [{ createdAt: "desc" }]),
    rail({ minPrice: { lte: UNDER_PRICE } }, [{ soldCount: "desc" }]),
  ]);

  const rails = [
    { key: "fresh_groceries", title: "Fresh Groceries & Vegetables", items: freshGroceries, query: { category: "grocery", sort: "popular" } },
    { key: "medicines_wellness", title: "Medicines & Daily Wellness", items: medicinesWellness, query: { category: "medicines", sort: "popular" } },
    { key: "deals", title: "Deals of the day", items: deals, query: { sort: "discount", discount: 20 } },
    { key: "bestsellers", title: "Bestsellers", items: bestsellers, query: { sort: "popular" } },
    { key: "top_rated", title: "Top rated", items: topRated, query: { sort: "rating", rating: 4 } },
    { key: "new", title: "New arrivals", items: newArrivals, query: { sort: "newest" } },
    { key: "budget", title: "Daily Essentials Under ₹499", items: budget, query: { maxPrice: UNDER_PRICE, sort: "popular" } },
  ].filter((rail) => rail.items.length > 0);

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
