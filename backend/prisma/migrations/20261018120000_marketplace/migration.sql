-- CreateEnum
CREATE TYPE "VendorMemberRole" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SubscriptionPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SubscriptionDeliveryStatus" AS ENUM ('SCHEDULED', 'SKIPPED', 'DELIVERED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CollectionMethod" AS ENUM ('CASH', 'UPI', 'OTHER');

-- CreateEnum
CREATE TYPE "DeliveryFeeMode" AS ENUM ('PER_DELIVERY', 'PER_PERIOD');

-- CreateEnum
CREATE TYPE "SubscriptionPaymentPlan" AS ENUM ('UPFRONT', 'TWO_INSTALMENTS', 'END_OF_PERIOD');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('ORDER_ISSUE', 'SUBSCRIPTION_ISSUE', 'APP_BUG', 'PAYMENT', 'ACCOUNT', 'VENDOR_COMPLAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "TicketLevel" AS ENUM ('MINOR', 'MAJOR');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('CUSTOMER', 'VENDOR', 'ADMIN', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION';
ALTER TYPE "NotificationType" ADD VALUE 'SUPPORT';
ALTER TYPE "NotificationType" ADD VALUE 'CHAT';

-- AlterEnum
ALTER TYPE "RecipientType" ADD VALUE 'VENDOR';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VENDOR';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockMovementType" ADD VALUE 'SUBSCRIPTION';
ALTER TYPE "StockMovementType" ADD VALUE 'COUNTER_SALE';

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "closesAt" TEXT,
ADD COLUMN     "deliveryRatePerKm" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "freeDeliveryAbove" INTEGER,
ADD COLUMN     "minDeliveryFee" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "opensAt" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "BranchStockMovement" ADD COLUMN     "subscriptionDeliveryId" TEXT;

-- AlterTable
ALTER TABLE "BranchVariantStock" ADD COLUMN     "costPrice" INTEGER,
ADD COLUMN     "mrp" INTEGER,
ADD COLUMN     "price" INTEGER;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "branchId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "commissionAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "commissionBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "distanceKm" DOUBLE PRECISION,
ADD COLUMN     "invoiceNumber" TEXT,
ADD COLUMN     "payoutId" TEXT,
ADD COLUMN     "vendorEarning" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "costPrice" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "createdByVendorId" TEXT;

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "linkToken" TEXT,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vendorId" TEXT,
ADD COLUMN     "vendorRole" "VendorMemberRole";

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shopName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logoUrl" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gstin" TEXT,
    "idProofType" TEXT,
    "idProofNumber" TEXT,
    "idProofUrl" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "commissionBps" INTEGER NOT NULL DEFAULT 1000,
    "payoutUpi" TEXT,
    "payoutDetails" TEXT,
    "subscriptionsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "quantityPerDelivery" INTEGER NOT NULL DEFAULT 1,
    "slots" TEXT[],
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "period" "SubscriptionPeriod" NOT NULL,
    "pricePerDelivery" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeMode" "DeliveryFeeMode" NOT NULL DEFAULT 'PER_DELIVERY',

    CONSTRAINT "SubscriptionPlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "period" "SubscriptionPeriod" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "weekdays" INTEGER NOT NULL,
    "slot" TEXT,
    "quantity" INTEGER NOT NULL,
    "pricePerDelivery" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "deliveryFeeMode" "DeliveryFeeMode" NOT NULL,
    "paymentPlan" "SubscriptionPaymentPlan" NOT NULL DEFAULT 'END_OF_PERIOD',
    "riderId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "SubscriptionDeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "quantity" INTEGER NOT NULL,
    "goodsAmount" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "markedById" TEXT,
    "note" TEXT,
    "payoutId" TEXT,

    CONSTRAINT "SubscriptionDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPause" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionInstalment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "SubscriptionInstalment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "CollectionMethod" NOT NULL DEFAULT 'CASH',
    "note" TEXT,
    "recordedById" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "deliveryCount" INTEGER NOT NULL,
    "grossAmount" INTEGER NOT NULL,
    "commissionAmount" INTEGER NOT NULL,
    "netAmount" INTEGER NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "reference" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "level" "TicketLevel" NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "orderId" TEXT,
    "subscriptionId" TEXT,
    "vendorId" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorRole" "MessageAuthor" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessage" TEXT NOT NULL DEFAULT '',
    "customerUnread" INTEGER NOT NULL DEFAULT 0,
    "vendorUnread" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderRole" "MessageAuthor" NOT NULL,
    "body" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CounterSale" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "total" INTEGER NOT NULL,
    "method" "CollectionMethod" NOT NULL DEFAULT 'CASH',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounterSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounterSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER,
    "quantity" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,

    CONSTRAINT "CounterSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "vendorId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_slug_key" ON "Vendor"("slug");

-- CreateIndex
CREATE INDEX "Vendor_status_idx" ON "Vendor"("status");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_branchId_isActive_idx" ON "SubscriptionPlan"("branchId", "isActive");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_vendorId_idx" ON "SubscriptionPlan"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlanPrice_planId_period_key" ON "SubscriptionPlanPrice"("planId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_number_key" ON "Subscription"("number");

-- CreateIndex
CREATE INDEX "Subscription_userId_createdAt_idx" ON "Subscription"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_vendorId_status_idx" ON "Subscription"("vendorId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionDelivery_date_status_idx" ON "SubscriptionDelivery"("date", "status");

-- CreateIndex
CREATE INDEX "SubscriptionDelivery_payoutId_idx" ON "SubscriptionDelivery"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionDelivery_subscriptionId_date_key" ON "SubscriptionDelivery"("subscriptionId", "date");

-- CreateIndex
CREATE INDEX "SubscriptionPause_subscriptionId_idx" ON "SubscriptionPause"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionInstalment_subscriptionId_sequence_key" ON "SubscriptionInstalment"("subscriptionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_receiptNumber_key" ON "SubscriptionPayment"("receiptNumber");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_subscriptionId_paidAt_idx" ON "SubscriptionPayment"("subscriptionId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_number_key" ON "Payout"("number");

-- CreateIndex
CREATE INDEX "Payout_vendorId_createdAt_idx" ON "Payout"("vendorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE INDEX "Ticket_userId_createdAt_idx" ON "Ticket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_vendorId_status_idx" ON "Ticket"("vendorId", "status");

-- CreateIndex
CREATE INDEX "Ticket_level_status_idx" ON "Ticket"("level", "status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_vendorId_lastMessageAt_idx" ON "Conversation"("vendorId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userId_vendorId_key" ON "Conversation"("userId", "vendorId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CounterSale_number_key" ON "CounterSale"("number");

-- CreateIndex
CREATE INDEX "CounterSale_vendorId_createdAt_idx" ON "CounterSale"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "CounterSale_branchId_createdAt_idx" ON "CounterSale"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "CounterSaleItem_saleId_idx" ON "CounterSaleItem"("saleId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_vendorId_createdAt_idx" ON "AuditLog"("vendorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Branch_vendorId_idx" ON "Branch"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Order_vendorId_status_createdAt_idx" ON "Order"("vendorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_payoutId_idx" ON "Order"("payoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_linkToken_key" ON "Rider"("linkToken");

-- CreateIndex
CREATE INDEX "Rider_vendorId_idx" ON "Rider"("vendorId");

-- CreateIndex
CREATE INDEX "User_vendorId_idx" ON "User"("vendorId");

-- Backfill: data that existed before vendors becomes the platform's own shop,
-- and existing branch listings take their price from the catalog variant.
INSERT INTO "Vendor" ("id", "slug", "shopName", "phone", "email", "address", "status", "commissionBps", "subscriptionsEnabled", "approvedAt", "updatedAt")
SELECT 'vendor_platform', 'haat',
       COALESCE((SELECT "storeName" FROM "Settings" WHERE "id" = 1), 'Haat'),
       COALESCE((SELECT NULLIF("supportPhone", '') FROM "Settings" WHERE "id" = 1), '0000000000'),
       COALESCE((SELECT "supportEmail" FROM "Settings" WHERE "id" = 1), 'support@haat.local'),
       '', 'APPROVED', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Branch") OR EXISTS (SELECT 1 FROM "Order") OR EXISTS (SELECT 1 FROM "Rider");

UPDATE "Branch" SET "vendorId" = 'vendor_platform' WHERE "vendorId" IS NULL;
ALTER TABLE "Branch" ALTER COLUMN "vendorId" SET NOT NULL;

UPDATE "BranchVariantStock" AS b SET "price" = v."price", "mrp" = v."mrp"
FROM "ProductVariant" AS v WHERE v."id" = b."variantId";
ALTER TABLE "BranchVariantStock" ALTER COLUMN "price" SET NOT NULL;
ALTER TABLE "BranchVariantStock" ALTER COLUMN "mrp" SET NOT NULL;

UPDATE "Order" SET "vendorId" = 'vendor_platform'
WHERE "vendorId" IS NULL AND EXISTS (SELECT 1 FROM "Vendor" WHERE "id" = 'vendor_platform');
UPDATE "Rider" SET "vendorId" = 'vendor_platform'
WHERE "vendorId" IS NULL AND EXISTS (SELECT 1 FROM "Vendor" WHERE "id" = 'vendor_platform');

-- The seeded admin is the super admin.
UPDATE "User" SET "isSuperAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_createdByVendorId_fkey" FOREIGN KEY ("createdByVendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BranchVariantStock"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPlanPrice" ADD CONSTRAINT "SubscriptionPlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionDelivery" ADD CONSTRAINT "SubscriptionDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionDelivery" ADD CONSTRAINT "SubscriptionDelivery_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPause" ADD CONSTRAINT "SubscriptionPause_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInstalment" ADD CONSTRAINT "SubscriptionInstalment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterSale" ADD CONSTRAINT "CounterSale_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterSaleItem" ADD CONSTRAINT "CounterSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "CounterSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

