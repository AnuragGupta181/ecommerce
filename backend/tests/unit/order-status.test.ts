import { describe, expect, it } from "vitest";
import { canCustomerCancel, canRequestReturn, canTransition } from "../../src/modules/orders/order-status.js";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("order status machine", () => {
  it("allows the forward fulfilment path", () => {
    expect(canTransition("PLACED", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "PACKED")).toBe(true);
    expect(canTransition("PACKED", "RIDER_ASSIGNED")).toBe(true);
    expect(canTransition("RIDER_ASSIGNED", "OUT_FOR_DELIVERY")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED")).toBe(true);
  });

  it("rejects skipping dispatch and moving terminal orders", () => {
    expect(canTransition("PLACED", "DELIVERED")).toBe(false);
    expect(canTransition("PACKED", "OUT_FOR_DELIVERY")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
  });

  it("only lets customers cancel before dispatch", () => {
    expect(canCustomerCancel("PLACED")).toBe(true);
    expect(canCustomerCancel("PACKED")).toBe(true);
    expect(canCustomerCancel("RIDER_ASSIGNED")).toBe(false);
    expect(canCustomerCancel("DELIVERED")).toBe(false);
  });

  it("allows returns only inside the return window", () => {
    const now = new Date("2026-10-10T12:00:00Z");
    const deliveredRecently = new Date(now.getTime() - 3 * DAY_MS);
    const deliveredLongAgo = new Date(now.getTime() - 8 * DAY_MS);
    expect(canRequestReturn("DELIVERED", deliveredRecently, 7, now)).toBe(true);
    expect(canRequestReturn("DELIVERED", deliveredLongAgo, 7, now)).toBe(false);
    expect(canRequestReturn("DELIVERED", deliveredRecently, 0, now)).toBe(false);
    expect(canRequestReturn("OUT_FOR_DELIVERY", deliveredRecently, 7, now)).toBe(false);
  });
});
