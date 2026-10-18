import { Router } from "express";
import { addressesRouter } from "./modules/addresses/addresses.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminBannersRouter, bannersRouter } from "./modules/banners/banners.routes.js";
import { adminBrandsRouter, brandsRouter } from "./modules/brands/brands.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { adminCategoriesRouter, categoriesRouter } from "./modules/categories/categories.routes.js";
import { coinsRouter } from "./modules/coins/coins.routes.js";
import { adminCouponsRouter, couponsRouter } from "./modules/coupons/coupons.routes.js";
import { adminDashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { homeRouter } from "./modules/home/home.routes.js";
import { adminNotificationLogRouter, notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { adminOrdersRouter, ordersRouter, vendorOrdersRouter } from "./modules/orders/orders.routes.js";
import { adminProductsRouter, productsRouter } from "./modules/products/products.routes.js";
import { adminReviewsRouter, reviewsRouter } from "./modules/reviews/reviews.routes.js";
import { adminRidersRouter, vendorRidersRouter } from "./modules/riders/riders.routes.js";
import { adminSettingsRouter, settingsRouter } from "./modules/settings/settings.routes.js";
import { adminUploadsRouter, uploadsRouter, vendorUploadsRouter } from "./modules/uploads/uploads.routes.js";
import { adminAdminsRouter } from "./modules/admins/admins.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { adminPayoutsRouter, vendorPayoutsRouter } from "./modules/payouts/payouts.routes.js";
import { adminReportsRouter, vendorReportsRouter } from "./modules/reports/reports.routes.js";
import { adminTicketsRouter, ticketsRouter, vendorTicketsRouter } from "./modules/tickets/tickets.routes.js";
import { adminCustomersRouter, profileRouter } from "./modules/users/users.routes.js";
import { wishlistRouter } from "./modules/wishlist/wishlist.routes.js";
import { adminAuditRouter } from "./modules/audit/audit.routes.js";
import { adminBranchesRouter, branchesRouter, vendorBranchesRouter } from "./modules/branches/branch.routes.js";
import { chatRouter, vendorChatRouter } from "./modules/chat/chat.routes.js";
import { vendorCounterSalesRouter } from "./modules/counter-sales/counter-sales.routes.js";
import { adminInventoryRouter, offersRouter, vendorListingsRouter, vendorProductsRouter } from "./modules/listings/listings.routes.js";
import { cronRouter } from "./modules/cron/cron.routes.js";
import {
  plansRouter,
  riderScheduleRouter,
  subscriptionsRouter,
  vendorDeliveriesRouter,
  vendorPlansRouter,
  vendorSubscriptionsRouter,
} from "./modules/subscriptions/subscriptions.routes.js";
import { adminVendorsRouter, vendorProfileRouter, vendorsRouter, vendorStaffRouter } from "./modules/vendors/vendors.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ data: { status: "ok", time: new Date().toISOString() } });
});

// Public (guest-browsable) and customer routes
apiRouter.use("/auth", authRouter);
apiRouter.use("/home", homeRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/brands", brandsRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/banners", bannersRouter);
apiRouter.use("/coupons", couponsRouter);
apiRouter.use("/reviews", reviewsRouter);
apiRouter.use("/profile", profileRouter);
apiRouter.use("/addresses", addressesRouter);
apiRouter.use("/wishlist", wishlistRouter);
apiRouter.use("/cart", cartRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/coins", coinsRouter);
apiRouter.use("/notifications", notificationsRouter);
apiRouter.use("/uploads", uploadsRouter);
apiRouter.use("/vendors", vendorsRouter);
apiRouter.use("/branches", branchesRouter);
apiRouter.use("/offers", offersRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/plans", plansRouter);
apiRouter.use("/subscriptions", subscriptionsRouter);
apiRouter.use("/rider-schedule", riderScheduleRouter);
apiRouter.use("/cron", cronRouter);
apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/documents", documentsRouter);

// Vendor portal routes: every router below applies `vendorOnly` and is scoped to the caller's shop
const vendor = Router();
vendor.use("/profile", vendorProfileRouter);
vendor.use("/staff", vendorStaffRouter);
vendor.use("/branches", vendorBranchesRouter);
vendor.use("/listings", vendorListingsRouter);
vendor.use("/products", vendorProductsRouter);
vendor.use("/orders", vendorOrdersRouter);
vendor.use("/riders", vendorRidersRouter);
vendor.use("/counter-sales", vendorCounterSalesRouter);
vendor.use("/messages", vendorChatRouter);
vendor.use("/plans", vendorPlansRouter);
vendor.use("/subscriptions", vendorSubscriptionsRouter);
vendor.use("/deliveries", vendorDeliveriesRouter);
vendor.use("/tickets", vendorTicketsRouter);
vendor.use("/payouts", vendorPayoutsRouter);
vendor.use("/reports", vendorReportsRouter);
vendor.use("/uploads", vendorUploadsRouter);
apiRouter.use("/vendor", vendor);

// Admin routes: every router below applies `adminOnly`
const admin = Router();
admin.use("/dashboard", adminDashboardRouter);
admin.use("/products", adminProductsRouter);
admin.use("/categories", adminCategoriesRouter);
admin.use("/brands", adminBrandsRouter);
admin.use("/inventory", adminInventoryRouter);
admin.use("/orders", adminOrdersRouter);
admin.use("/riders", adminRidersRouter);
admin.use("/customers", adminCustomersRouter);
admin.use("/coupons", adminCouponsRouter);
admin.use("/banners", adminBannersRouter);
admin.use("/reviews", adminReviewsRouter);
admin.use("/settings", adminSettingsRouter);
admin.use("/notification-logs", adminNotificationLogRouter);
admin.use("/uploads", adminUploadsRouter);
admin.use("/vendors", adminVendorsRouter);
admin.use("/branches", adminBranchesRouter);
admin.use("/audit", adminAuditRouter);
admin.use("/tickets", adminTicketsRouter);
admin.use("/payouts", adminPayoutsRouter);
admin.use("/reports", adminReportsRouter);
admin.use("/admins", adminAdminsRouter);
apiRouter.use("/admin", admin);
