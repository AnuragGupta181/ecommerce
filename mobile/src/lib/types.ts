/** Shapes returned by the backend (see docs/API.md). Money fields are integer paise; dates are ISO strings. */

export type Role = "CUSTOMER" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  coinBalance: number;
  referralCode?: string | null;
  vendorId?: string | null;
  vendorRole?: "OWNER" | "STAFF" | null;
  isSuperAdmin?: boolean;
  createdAt: string;
};

export type Session = { user: User; accessToken: string; refreshToken: string };

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };
export type Page<T> = { data: T[]; meta?: PageMeta };

export type ProductCard = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  price: number;
  mrp: number;
  discountPercent: number;
  ratingAvg: number;
  ratingCount: number;
  inStock: boolean;
  defaultVariantId: string | null;
  variantCount: number;
  isWishlisted: boolean;
  /** Best shop for the shopper's location; null when no shop lists it. */
  shop?: { vendorName: string; vendorSlug: string; distanceKm: number | null; isOpen: boolean; label: OfferLabel } | null;
  shopCount?: number;
};

export type OfferLabel = "AVAILABLE" | "CLOSED" | "OUT_OF_STOCK" | "TOO_FAR";

/** A shop branch as the backend describes it everywhere (`describeShop`). */
export type Shop = {
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

/** One shop selling a variant; `offers[]` arrive ranked, the first is the default. */
export type ShopOffer = {
  listingId: string;
  variantId: string;
  price: number;
  mrp: number;
  discountPercent: number;
  inStock: boolean;
  stockLeft: number | null;
  label: OfferLabel;
  shop: Shop;
};

export type CategoryNode = { id: string; name: string; slug: string; imageUrl: string | null; parentId: string | null; children?: CategoryNode[] };

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  linkType: "NONE" | "PRODUCT" | "CATEGORY" | "SEARCH" | "URL";
  linkValue: string | null;
};

export type HomeFeed = {
  banners: { carousel: Banner[]; strip: Banner[] };
  categories: CategoryNode[];
  rails: { key: string; title: string; items: ProductCard[]; query: Record<string, string | number> }[];
  dailyEssentials?: Plan[];
  shops?: Shop[];
};

export type Offer = { code: string; title: string; description: string; firstOrderOnly?: boolean; endsAt: string | null };

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string;
  highlights: string[];
  specs: { label: string; value: string }[];
  brand: { id: string; name: string; slug: string } | null;
  category: { id: string; name: string; slug: string; parent: { id: string; name: string; slug: string } | null };
  images: { id: string; url: string; alt: string | null }[];
  variants: {
    id: string;
    sku: string;
    label: string;
    attributes: Record<string, string>;
    mrp: number;
    price: number;
    inStock: boolean;
    stock: number | null;
    offers?: ShopOffer[];
  }[];
  price: number;
  mrp: number;
  discountPercent: number;
  rating: { average: number; count: number; breakdown: Record<string, number> };
  topReviews: ReviewItem[];
  offers: Offer[];
  isWishlisted: boolean;
};

export type ReviewItem = { id: string; rating: number; title: string | null; comment: string | null; createdAt: string; userName: string };

export type Suggestions = {
  products: { id: string; slug: string; name: string; imageUrl: string | null }[];
  categories: { id: string; name: string; slug: string }[];
  brands: { id: string; name: string; slug: string }[];
};

export type Facets = { brands: { slug: string; name: string; count: number }[]; price: { min: number; max: number } };

export type CartLine = {
  id: string;
  listingId?: string | null;
  quantity: number;
  maxQuantity: number;
  available: boolean;
  unavailableReason: string | null;
  lineMrp: number;
  lineTotal: number;
  variant: { id: string; sku: string; label: string; mrp: number; price: number };
  product: { id: string; slug: string; name: string; brand: string | null; imageUrl: string | null };
};

export type PriceSummary = {
  itemCount: number;
  itemsMrp: number;
  itemsTotal: number;
  mrpDiscount: number;
  couponCode: string | null;
  couponDiscount: number;
  couponError: string | null;
  coinsAvailable: number;
  coinsRedeemable: number;
  coinsUsed: number;
  coinsDiscount: number;
  deliveryFee: number;
  amountForFreeDelivery: number;
  payable: number;
  totalSavings: number;
  coinsToEarn: number;
};

export type Cart = { shop: Shop | null; items: CartLine[]; summary: PriceSummary; deliverable: boolean };

/** Another shop that could fill the cart ("switch shop"). `itemsTotal` is the server's figure. */
export type CartShopOption = Shop & { availableItems: number; totalItems: number; itemsTotal: number; isCurrent: boolean };

export type CartCoupon = Offer & { minOrderValue: number; applicable: boolean; reason: string | null };

export type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
  /** Delivery point (GPS or chosen location); drives distance and delivery fee. */
  lat?: number | null;
  lng?: number | null;
};
export type AddressInput = Omit<Address, "id">;

export type OrderStatus =
  | "PLACED"
  | "CONFIRMED"
  | "PACKED"
  | "RIDER_ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "RETURNED"
  | "RETURN_REJECTED";

export type OrderSummary = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  payable: number;
  createdAt: string;
  deliveredAt: string | null;
  items: { productName: string; imageUrl: string | null; quantity: number }[];
  itemCount: number;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: "COD" | "UPI_ON_DELIVERY";
  paymentStatus: "PENDING" | "PAID" | "REFUNDED";
  shippingAddress: Omit<Address, "id" | "type" | "isDefault">;
  vendorId?: string | null;
  branchId?: string | null;
  invoiceNumber?: string | null;
  itemsMrp: number;
  itemsTotal: number;
  couponCode: string | null;
  couponDiscount: number;
  coinsUsed: number;
  deliveryFee: number;
  payable: number;
  coinsToEarn: number;
  coinsEarned: number;
  cancelReason: string | null;
  returnReason: string | null;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    productSlug: string;
    productName: string;
    variantLabel: string;
    imageUrl: string | null;
    mrp: number;
    price: number;
    quantity: number;
    lineTotal: number;
    canReview: boolean;
  }[];
  timeline: { status: OrderStatus; at: string | null }[];
  history: { status: OrderStatus; note: string | null; createdAt: string }[];
  rider: { name: string; phone: string; whatsapp: string | null; vehicleType: string; vehicleNumber: string | null } | null;
  actions: { canCancel: boolean; canReturn: boolean };
};

export type PlacedOrder = { id: string; orderNumber: string; payable: number; coinsToEarn: number };

export type Coins = {
  balance: number;
  lifetimeEarned: number;
  pending: number;
  history: { id: string; type: string; amount: number; balanceAfter: number; note: string | null; orderNumber: string | null; createdAt: string }[];
};

export type AppNotification = { id: string; type: "ORDER" | "PROMO" | "SYSTEM"; title: string; body: string; data: { orderId?: string } | null; readAt: string | null; createdAt: string };

export type StoreSettings = {
  storeName: string;
  supportEmail: string;
  supportPhone: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  coinEarnPer100: number;
  coinMaxRedeemPercent: number;
  returnWindowDays: number;
  codEnabled: boolean;
  upiOnDeliveryEnabled: boolean;
  referralEnabled?: boolean;
  referralReferrerCoins?: number;
  referralRefereeCoins?: number;
};

export type ReferralSummary = {
  referralCode: string;
  completedCount: number;
  pendingCount: number;
  totalCoinsEarned: number;
  referrerBonus: number;
  refereeBonus: number;
  enabled: boolean;
};

/* ---------- Marketplace: shop page, daily essentials, subscriptions, support, chat ---------- */

export type VendorPage = {
  id: string;
  slug: string;
  shopName: string;
  description: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  subscriptionsEnabled: boolean;
  branches: Shop[];
  listingCount: number;
  deliveredOrders: number;
  planCount: number;
};

export type Period = "WEEKLY" | "MONTHLY";
export type PaymentPlan = "UPFRONT" | "TWO_INSTALMENTS" | "END_OF_PERIOD";

export type PlanPrice = { period: Period; pricePerDelivery: number; deliveryFee: number; deliveryFeeMode: "PER_DELIVERY" | "PER_PERIOD" };

export type Plan = {
  id: string;
  name: string;
  description: string;
  quantityPerDelivery: number;
  slots: string[];
  capacity: number | null;
  isActive: boolean;
  prices: PlanPrice[];
  product: { id: string; name: string; slug: string; variantLabel: string; imageUrl: string | null; regularPrice: number };
  shop: Shop;
  activeSubscribers: number;
  isFull: boolean;
};

export type SubscriptionInput = {
  planId: string;
  period: Period;
  startDate: string;
  /** Bitmask, Mon = 1 … Sun = 64 (lib/weekdays.ts). */
  weekdays: number;
  quantity: number;
  slot?: string;
  skipDates: string[];
  paymentPlan: PaymentPlan;
  addressId?: string;
};

export type SubscriptionQuote = {
  plan: Plan;
  period: Period;
  quantity: number;
  weekdays: string[];
  schedule: { startDate: string; endDate: string; dates: string[]; skipped: string[] };
  terms: { quantity: number; pricePerDelivery: number; deliveryFee: number; deliveryFeeMode: "PER_DELIVERY" | "PER_PERIOD" };
  breakdown: { deliveries: number; perDelivery: { goods: number; deliveryFee: number }; goodsTotal: number; deliveryTotal: number; total: number };
  instalments: { sequence: number; dueDate: string; amount: number }[];
  shop: Shop;
};

export type SubscriptionStatus = "ACTIVE" | "CANCELLED" | "COMPLETED";
export type DeliveryStatus = "SCHEDULED" | "SKIPPED" | "DELIVERED" | "MISSED" | "CANCELLED";
export type InstalmentStatus = "PAID" | "PARTLY_PAID" | "DUE" | "OVERDUE" | "UPCOMING";

export type SubscriptionSummary = {
  id: string;
  number: string;
  status: SubscriptionStatus;
  period: Period;
  startDate: string;
  endDate: string;
  weekdays: string[];
  slot: string | null;
  quantity: number;
  vendor: { id: string; shopName: string; slug: string };
  product: { name: string; variantLabel: string; imageUrl: string | null };
  plan: { name: string };
  nextDelivery: string | null;
};

export type SubscriptionDetail = Omit<SubscriptionSummary, "plan" | "nextDelivery"> & {
  weekdayMask: number;
  pricePerDelivery: number;
  deliveryFee: number;
  deliveryFeeMode: "PER_DELIVERY" | "PER_PERIOD";
  paymentPlan: PaymentPlan;
  shippingAddress: Omit<Address, "id" | "type" | "isDefault">;
  cancelReason: string | null;
  plan: { id: string; name: string; slots: string[] };
  product: { name: string; slug: string; variantLabel: string; imageUrl: string | null };
  vendor: { id: string; shopName: string; slug: string; phone: string | null; email: string | null };
  branch: { id: string; name: string };
  rider: { id: string; name: string; phone: string; whatsapp: string | null; vehicleType: string } | null;
  deliveries: { id: string; date: string; status: DeliveryStatus; quantity: number; amount: number; deliveredAt: string | null; note: string | null; canChange: boolean }[];
  pauses: { id: string; fromDate: string; toDate: string }[];
  payments: { id: string; receiptNumber: string; amount: number; method: "CASH" | "UPI" | "OTHER"; note: string | null; paidAt: string }[];
  ledger: {
    charged: number;
    paid: number;
    balance: number;
    expectedTotal: number;
    dueNow: number;
    instalments: { sequence: number; dueDate: string; amount: number; status: InstalmentStatus }[];
  };
  actions: { canCancel: boolean; canRenew: boolean };
};

export type TicketCategory = "ORDER_ISSUE" | "SUBSCRIPTION_ISSUE" | "APP_BUG" | "PAYMENT" | "ACCOUNT" | "VENDOR_COMPLAINT" | "OTHER";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type TicketSummary = {
  id: string;
  number: string;
  category: TicketCategory;
  level: "MINOR" | "MAJOR";
  subject: string;
  status: TicketStatus;
  orderId: string | null;
  subscriptionId: string | null;
  lastMessageAt: string;
  createdAt: string;
  vendor: { id: string; shopName: string } | null;
  order?: { orderNumber: string } | null;
  messageCount?: number;
};

export type TicketDetail = TicketSummary & {
  messages: { id: string; authorRole: "CUSTOMER" | "VENDOR" | "ADMIN" | "SYSTEM"; body: string; createdAt: string; mine: boolean }[];
  handledBy?: "SHOP" | "PLATFORM";
};

export type TicketInput = { category: TicketCategory; subject: string; message: string; orderId?: string; subscriptionId?: string };

export type Conversation = {
  id: string;
  lastMessage: string | null;
  lastMessageAt: string;
  unread: number;
  vendor: { id: string; shopName: string; slug: string; logoUrl: string | null };
};

export type ChatMessage = {
  id: string;
  body: string;
  senderRole: "CUSTOMER" | "VENDOR" | "SYSTEM";
  mine: boolean;
  createdAt: string;
  order: { id: string; orderNumber: string; status: OrderStatus } | null;
};
