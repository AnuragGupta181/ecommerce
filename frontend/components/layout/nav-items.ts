import {
  BarChart3,
  Bell,
  Boxes,
  CalendarCheck,
  ClipboardList,
  FolderTree,
  History,
  Image,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Package,
  Receipt,
  Repeat,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Tag,
  TicketPercent,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type Portal = "admin" | "vendor";
export type NavItem = { href: string; label: string; icon: LucideIcon; superAdminOnly?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

const adminNav: NavGroup[] = [
  { label: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Marketplace",
    items: [
      { href: "/vendors", label: "Vendors", icon: Store },
      { href: "/tickets", label: "Tickets", icon: LifeBuoy },
      { href: "/payouts", label: "Payouts", icon: Wallet },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/brands", label: "Brands", icon: Tag },
      { href: "/inventory", label: "Shop stock", icon: Boxes },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/orders", label: "Orders", icon: ClipboardList },
      { href: "/riders", label: "Riders", icon: Truck },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/coupons", label: "Coupons", icon: TicketPercent },
      { href: "/banners", label: "Banners", icon: Image },
      { href: "/reviews", label: "Reviews", icon: Star },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admins", label: "Admins", icon: ShieldCheck, superAdminOnly: true },
      { href: "/audit", label: "Audit log", icon: History, superAdminOnly: true },
      { href: "/notifications", label: "Notification log", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const vendorNav: NavGroup[] = [
  { label: "Today", items: [{ href: "/vendor", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Sell",
    items: [
      { href: "/vendor/orders", label: "Orders", icon: ClipboardList },
      { href: "/vendor/counter", label: "Counter bills", icon: Receipt },
      { href: "/vendor/stock", label: "Products & stock", icon: Boxes },
      { href: "/vendor/riders", label: "Riders", icon: Truck },
    ],
  },
  {
    label: "Daily needs",
    items: [
      { href: "/vendor/deliveries", label: "Deliveries", icon: CalendarCheck },
      { href: "/vendor/subscriptions", label: "Subscribers", icon: Users },
      { href: "/vendor/plans", label: "Plans", icon: Repeat },
    ],
  },
  {
    label: "Customers",
    items: [
      { href: "/vendor/messages", label: "Messages", icon: MessageSquare },
      { href: "/vendor/tickets", label: "Tickets", icon: LifeBuoy },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/vendor/payouts", label: "Payouts", icon: Wallet },
      { href: "/vendor/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  { label: "Shop", items: [{ href: "/vendor/shop", label: "Shop settings", icon: Settings }] },
];

export function navGroupsFor(portal: Portal, superAdmin: boolean): NavGroup[] {
  const groups = portal === "vendor" ? vendorNav : adminNav;
  return groups.map((group) => ({ ...group, items: group.items.filter((item) => superAdmin || !item.superAdminOnly) }));
}

export function homeHref(portal: Portal): string {
  return portal === "vendor" ? "/vendor" : "/";
}

export function isActive(pathname: string, href: string): boolean {
  return href === "/" || href === "/vendor" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
