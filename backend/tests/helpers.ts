import request from "supertest";
import { createApp } from "../src/app.js";
import type { Role } from "../src/generated/prisma/enums.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";

export const app = createApp();
export const api = () => request(app);

let counter = 0;
export function unique(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter}`;
}

export const TEST_PASSWORD = "Passw0rd!";

/** Creates a user directly in the DB and logs in through the API. */
export async function createUserSession(role: Role = "CUSTOMER") {
  const email = `${unique("user")}@test.local`;
  const phone = `+919${String(Date.now() + counter).slice(-9)}`;
  await prisma.user.create({
    data: { name: role === "ADMIN" ? "Test Admin" : "Test Customer", email, phone, role, passwordHash: await hashPassword(TEST_PASSWORD) },
  });
  const res = await api().post("/api/v1/auth/login").send({ identifier: email, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  const { user, accessToken, refreshToken } = res.body.data as {
    user: { id: string; email: string };
    accessToken: string;
    refreshToken: string;
  };
  return { user, accessToken, refreshToken, auth: { Authorization: `Bearer ${accessToken}` } };
}
