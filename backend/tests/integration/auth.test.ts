import { afterAll, describe, expect, it } from "vitest";
import { sha256 } from "../../src/lib/crypto.js";
import { prisma } from "../../src/lib/prisma.js";
import { flushNotifications } from "../../src/services/notify/index.js";
import { api, createUserSession, unique } from "../helpers.js";

afterAll(() => prisma.$disconnect());

describe("auth", () => {
  const email = `${unique("signup")}@test.local`;
  const password = "Secret123";

  it("registers a customer and returns a session", async () => {
    const res = await api()
      .post("/api/v1/auth/register")
      .send({ name: "Asha", email, phone: "9876500001", password });

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ email, phone: "+919876500001", role: "CUSTOMER", coinBalance: 0 });
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate email and invalid input", async () => {
    const dup = await api().post("/api/v1/auth/register").send({ name: "Asha", email, phone: "9876500002", password });
    expect(dup.status).toBe(409);

    const invalid = await api().post("/api/v1/auth/register").send({ name: "A", email: "nope", password: "short" });
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with email or phone and rejects bad passwords", async () => {
    expect((await api().post("/api/v1/auth/login").send({ identifier: email, password })).status).toBe(200);
    expect((await api().post("/api/v1/auth/login").send({ identifier: "98765 00001", password })).status).toBe(200);
    const bad = await api().post("/api/v1/auth/login").send({ identifier: email, password: "wrong" });
    expect(bad.status).toBe(401);
  });

  it("rotates refresh tokens and revokes all sessions on reuse", async () => {
    const session = await createUserSession();
    const first = await api().post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    expect(first.status).toBe(200);

    // Move the rotation outside the grace window so the reuse looks like theft.
    await prisma.refreshToken.update({
      where: { tokenHash: sha256(session.refreshToken) },
      data: { rotatedAt: new Date(Date.now() - 60_000) },
    });
    const reuse = await api().post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken });
    expect(reuse.status).toBe(401);

    // The token issued by the first rotation is now revoked as well.
    const afterReuse = await api().post("/api/v1/auth/refresh").send({ refreshToken: first.body.data.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it("tolerates a racing refresh right after rotation but not after logout", async () => {
    const session = await createUserSession();
    const [a, b] = await Promise.all([
      api().post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken }),
      api().post("/api/v1/auth/refresh").send({ refreshToken: session.refreshToken }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.data.refreshToken).not.toBe(b.body.data.refreshToken);

    const loggedOut = await createUserSession();
    expect((await api().post("/api/v1/auth/logout").send({ refreshToken: loggedOut.refreshToken })).status).toBe(204);
    const afterLogout = await api().post("/api/v1/auth/refresh").send({ refreshToken: loggedOut.refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it("protects /me and blocks admin routes for customers", async () => {
    expect((await api().get("/api/v1/auth/me")).status).toBe(401);
    const session = await createUserSession();
    const me = await api().get("/api/v1/auth/me").set(session.auth);
    expect(me.status).toBe(200);
    expect((await api().get("/api/v1/admin/settings").set(session.auth)).status).toBe(403);
  });

  it("resets the password with an emailed OTP", async () => {
    const session = await createUserSession();
    await api().post("/api/v1/auth/password/forgot").send({ email: session.user.email }).expect(200);
    await flushNotifications();

    // Replace the stored OTP hash with a known code; the real code only exists in the email.
    const reset = await prisma.passwordReset.findFirstOrThrow({ where: { userId: session.user.id } });
    await prisma.passwordReset.update({ where: { id: reset.id }, data: { otpHash: sha256("123456") } });

    const wrong = await api()
      .post("/api/v1/auth/password/reset")
      .send({ email: session.user.email, otp: "000000", password: "NewPass123" });
    expect(wrong.status).toBe(400);

    await api()
      .post("/api/v1/auth/password/reset")
      .send({ email: session.user.email, otp: "123456", password: "NewPass123" })
      .expect(200);

    const login = await api().post("/api/v1/auth/login").send({ identifier: session.user.email, password: "NewPass123" });
    expect(login.status).toBe(200);

    const log = await prisma.notificationLog.findFirst({ where: { template: "password_reset", recipient: session.user.email } });
    expect(log?.body).toBe("[redacted]");
  });
});
