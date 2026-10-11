import {
  Bell,
  Boxes,
  ClipboardList,
  FolderTree,
  Image,
  LayoutDashboard,
  Package,
  Settings,
  Star,
  Tag,
  TicketPercent,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  { label: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    label: "Catalog",
    items: [
      { href: "/products", label: "Products", icon: Package },
      { href: "/categories", label: "Categories", icon: FolderTree },
      { href: "/brands", label: "Brands", icon: Tag },
      { href: "/inventory", label: "Inventory", icon: Boxes },
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
      { href: "/notifications", label: "Notification log", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
