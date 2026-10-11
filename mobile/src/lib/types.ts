/** Shapes returned by the backend (see docs/API.md). Money fields are integer paise. */

export type Role = "CUSTOMER" | "ADMIN";

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  avatarUrl: string | null;
  coinBalance: number;
  createdAt: string;
};

export type Session = { user: User; accessToken: string; refreshToken: string };

export type PageMeta = { page: number; limit: number; total: number; totalPages: number };
