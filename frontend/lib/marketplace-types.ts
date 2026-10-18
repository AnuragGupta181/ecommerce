/** Marketplace shapes returned by the backend (docs/API.md "Marketplace"). Money is integer paise; dates are ISO strings. */

import type { OrderDetail, OrderStatus, PaymentMethod, ShippingAddress, StockStatus } from "./types";

export type VendorStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type PayMethod = "CASH" | "UPI" | "OTHER";

export type Vendor = {
  id: string;
  slug: string;
  shopName: string;
  description: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  address: string;
  gstin: string | null;
  idProofType: string | null;
  idProofNumber: string | null;
  idProofUrl: string | null;
  status: VendorStatus;
  rejectionReason: string | null;
  commissionBps: number;
  payoutUpi: string | null;
  payoutDetails: string | null;
  subscriptionsEnabled: boolean;
  approvedAt: string | null;
  createdAt: string;
};

export type VendorRow = Vendor & { branchCount: number; orderCount: number; planCount: number };

/** The `shop` object used everywhere a branch is shown to someone. */
export type ShopCard = {
  branchId: string;
  branchName: string;
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  logoUrl: string | null;
  isOpen: boolean;
  statusMessage: string | null;
  distanceKm: number | null;
  deliveryFee: number;
  freeDeliveryAbove: number | null;
  deliverable: boolean;
};

export type VendorMember = { id: string; name: string; email: string; phone: string | null; vendorRole: "OWNER" | "STAFF"; isBlocked: boolean; createdAt?: string };

export type AdminVendorDetail = Vendor & {
  members: VendorMember[];
  branches: (ShopCard & { address: string; city: string; lat: number; lng: number })[];
  stats: { orders: number; listings: number; openTickets: number; deliveredSales: number; commissionEarned: number; vendorEarnings: number };
};

export type Branch = ShopCard & {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isActive: boolean;
  isOnline: boolean;
  offlineMessage: string | null;
  opensAt: string | null;
  closesAt: string | null;
  deliveryRadiusKm: number;
  deliveryRatePerKm: number;
  minDeliveryFee: number;
  address: string;
  city: string;
  state?: string;
  pincode?: string;
  phone?: string | null;
  email?: string | null;
  vendor: { id: string; slug: string; shopName: string; status: VendorStatus; logoUrl: string | null };
  listingCount: number;
  orderCount: number;
};

export type BranchInput = {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
  phone: string | null;
  deliveryRadiusKm: number;
  deliveryRatePerKm: number;
  minDeliveryFee: number;
  freeDeliveryAbove: number | null;
  opensAt: string | null;
  closesAt: string | null;
};

export type VendorProfileInput = {
  shopName: string;
  description: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  address: string;
  gstin: string | null;
  payoutUpi: string | null;
  payoutDetails: string | null;
  subscriptionsEnabled?: boolean;
};

export type VendorDashboard = {
  shop: { shopName: string; status: VendorStatus; rejectionReason: string | null; subscriptionsEnabled: boolean; commissionBps: number };
  today: { date: string; newOrders: number; toConfirm: number; toPack: number; toDispatch: number; outForDelivery: number; dropsScheduled: number; dropsDelivered: number };
  period: { days: number; ordersDelivered: number; sales: number; earnings: number; commission: number };
  stock: { lowStock: number; outOfStock: number; totalUnits: number; stockValue: number };
  unreadMessages: number;
  openTickets: number;
  activeSubscribers: number;
  recentOrders: { id: string; orderNumber: string; status: OrderStatus; payable: number; createdAt: string; customer: string }[];
  series: { date: string; revenue: number; orders: number }[];
};

// ───────── listings (a shop's stock) ─────────

export type Listing = {
  id: string;
  price: number;
  mrp: number;
  costPrice?: number | null;
  stock: number;
  lowStockThreshold: number;
  isAvailable: boolean;
  status: StockStatus;
  updatedAt: string;
  branch: { id: string; name: string };
  vendor: { id: string; shopName: string };
  variant: { id: string; sku: string; label: string };
  product: { id: string; name: string; slug: string; isActive: boolean; category: string; imageUrl: string | null; ownedByVendor: boolean };
};

export type ListingSummary = { lowStock: number; outOfStock: number; totalUnits: number; stockValue: number };

export type ListingMovement = {
  id: string;
  type: "IN" | "OUT" | "SET" | "SALE" | "CANCEL" | "RETURN" | "SUBSCRIPTION" | "COUNTER_SALE";
  quantity: number;
  stockAfter: number;
  reason: string | null;
  createdAt: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: { name: string };
  imageUrl: string | null;
  ownedByMe: boolean;
  variants: { id: string; sku: string; label: string; mrp: number; price: number; listedAt: string[]; listedHere: boolean }[];
};

// ───────── orders, riders, counter ─────────

export type MarketplaceOrderDetail = OrderDetail & {
  distanceKm: number | null;
  commissionBps: number;
  commissionAmount: number;
  vendorEarning: number;
  invoiceNumber: string | null;
  vendor: { id: string; shopName: string; phone: string; email: string } | null;
  branch: { id: string; name: string; address: string } | null;
};

export type CounterSaleRow = {
  id: string;
  number: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  method: PayMethod;
  createdAt: string;
  itemCount: number;
};

// ───────── chat ─────────

export type Conversation = {
  id: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unread: number;
  vendor: { id: string; shopName: string; slug: string; logoUrl: string | null };
  customer: { id: string; name: string; phone: string | null };
};

export type ChatMessage = {
  id: string;
  body: string;
  senderRole: "CUSTOMER" | "VENDOR" | "SYSTEM";
  mine: boolean;
  createdAt: string;
  order: { id: string; orderNumber: string } | null;
};

// ───────── subscriptions ─────────

export type Period = "WEEKLY" | "MONTHLY";
export type DeliveryFeeMode = "PER_DELIVERY" | "PER_PERIOD";
export type PlanPrice = { period: Period; pricePerDelivery: number; deliveryFee: number; deliveryFeeMode: DeliveryFeeMode };

export type Plan = {
  id: string;
  name: string;
  description: string;
  quantityPerDelivery: number;
  slots: string[];
  capacity: number | null;
  isActive: boolean;
  createdAt: string;
  prices: PlanPrice[];
  listingId?: string;
  product: { id: string; name: string; slug: string; variantLabel: string; imageUrl: string | null; regularPrice: number };
  shop: ShopCard;
  activeSubscribers: number;
  isFull: boolean;
};

export type PlanInput = {
  listingId: string;
  name: string;
  description: string;
  quantityPerDelivery: number;
  slots: string[];
  capacity: number | null;
  isActive: boolean;
  prices: PlanPrice[];
};

export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "COMPLETED";
export type DeliveryStatus = "SCHEDULED" | "SKIPPED" | "DELIVERED" | "MISSED" | "CANCELLED";

export type SubscriptionRow = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  period: Period;
  startDate: string;
  endDate: string;
  slot: string | null;
  quantity: number;
  customer: { name: string; phone: string | null };
  plan: { name: string };
  rider: { id: string; name: string } | null;
  balance: number;
  dueNow: number;
};

export type Ledger = {
  charged: number;
  paid: number;
  balance: number;
  expectedTotal: number;
  dueNow: number;
  instalments: { sequence: number; dueDate: string; amount: number; status: string }[];
};

export type SubscriptionDetail = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  period: Period;
  startDate: string;
  endDate: string;
  weekdays: string[];
  slot: string | null;
  quantity: number;
  pricePerDelivery: number;
  deliveryFee: number;
  deliveryFeeMode: DeliveryFeeMode;
  paymentPlan: "UPFRONT" | "TWO_INSTALMENTS" | "END_OF_PERIOD";
  shippingAddress: ShippingAddress;
  cancelReason: string | null;
  plan: { id: string; name: string };
  product: { name: string; variantLabel: string; imageUrl: string | null };
  rider: { id: string; name: string; phone: string } | null;
  customer: { id: string; name: string; email: string; phone: string | null };
  deliveries: { id: string; date: string; status: DeliveryStatus; quantity: number; amount: number; deliveredAt: string | null; note: string | null }[];
  pauses: { id: string; fromDate: string; toDate: string }[];
  payments: { id: string; receiptNumber: string; amount: number; method: PayMethod; note: string | null; paidAt: string }[];
  ledger: Ledger;
};

export type DeliveryDay = {
  date: string;
  deliveries: {
    id: string;
    date: string;
    status: DeliveryStatus;
    quantity: number;
    amount: number;
    deliveredAt: string | null;
    note: string | null;
    slot: string | null;
    subscription: { id: string; number: string };
    customer: { name: string; phone: string | null };
    address: string;
    mapUrl: string | null;
    product: string;
    planName: string;
    rider: { id: string; name: string } | null;
  }[];
  toLoad: { product: string; quantity: number }[];
  counts: { scheduled: number; delivered: number; missed: number };
};

export type RiderSchedule = {
  rider: { name: string; shop: string | null; shopPhone: string | null };
  date: string;
  today: DeliveryDay["deliveries"];
  month: { date: string; drops: number; units: number }[];
  orders: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    payable: number;
    paymentMethod: PaymentMethod;
    shippingAddress: ShippingAddress;
    items: { productName: string; quantity: number }[];
    collect: string;
  }[];
};

// ───────── tickets ─────────

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type TicketLevel = "MINOR" | "MAJOR";

export type TicketRow = {
  id: string;
  number: string;
  category: string;
  level: TicketLevel;
  subject: string;
  status: TicketStatus;
  lastMessageAt: string;
  createdAt: string;
  user: { name: string };
  vendor?: { shopName: string } | null;
  order: { orderNumber: string } | null;
  messageCount: number;
};

export type TicketDetail = Omit<TicketRow, "user" | "order" | "messageCount"> & {
  vendor?: { id?: string; shopName: string } | null;
  messages: { id: string; authorRole: "CUSTOMER" | "VENDOR" | "ADMIN" | "SYSTEM"; body: string; createdAt: string; mine: boolean }[];
  context: {
    customer: { id: string; name: string; email: string; phone: string | null; createdAt: string; isBlocked: boolean; deliveredOrders: number; totalSpent: number };
    recentOrders: { id: string; orderNumber: string; status: OrderStatus; payable: number; createdAt: string }[];
    order: {
      id: string;
      orderNumber: string;
      status: OrderStatus;
      payable: number;
      paymentMethod: PaymentMethod;
      createdAt: string;
      deliveredAt: string | null;
      shop: string | null;
      items: { productName: string; variantLabel: string; quantity: number; price: number; lineTotal: number; imageUrl: string | null }[];
      rider: { name: string; phone: string } | null;
    } | null;
    subscription: { id: string; number: string; status: SubscriptionStatus; planName?: string } | null;
  };
  handledBy: "SHOP" | "PLATFORM";
};

// ───────── payouts ─────────

export type PayoutRow = {
  id: string;
  number: string;
  periodFrom: string;
  periodTo: string;
  orderCount: number;
  deliveryCount: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  status: "PENDING" | "PAID";
  reference: string | null;
  paidAt: string | null;
  createdAt: string;
  vendor?: { id: string; shopName: string };
};

export type SettlementPreview = {
  orderCount: number;
  deliveryCount: number;
  grossAmount: number;
  commissionAmount: number;
  vendorEarning: number;
  collectedByVendor: number;
  netAmount: number;
  orders: { id: string; orderNumber: string; deliveredAt: string; payable: number; commissionAmount: number; vendorEarning: number }[];
  drops: { id: string; date: string; goodsAmount: number; deliveryFee: number; subscription: { number: string } }[];
};

// ───────── platform ─────────

export type AdminAccount = { id: string; name: string; email: string; phone: string | null; isSuperAdmin: boolean; isBlocked: boolean; createdAt: string };

export type AuditEntry = {
  id: string;
  actorRole: string | null;
  vendorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  data: unknown;
  createdAt: string;
  actor: { name: string; email: string } | null;
};
