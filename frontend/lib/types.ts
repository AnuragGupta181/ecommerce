/** Shapes returned by the backend (see docs/API.md). Money fields are integer paise. */

export type Role = "CUSTOMER" | "ADMIN";

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

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };

export type Paginated<T> = { items: T[]; meta: PageMeta };

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
};

export type Session = { user: SessionUser; accessToken: string; refreshToken: string };
