import { ApiError } from "@/lib/api";
import { conflictMessage, isShopUnavailable, shopConflict } from "@/lib/cart-conflict";
import { lastMessageAt, mergeMessages } from "@/lib/chat-thread";
import { reachableDocumentUrl } from "@/lib/document-link";
import { formatDistance, locationHeader, parseLatLng, presetByPincode } from "@/lib/geo";
import type { ChatMessage, Shop } from "@/lib/types";
import { addDays, calendarMonths, describeWeekdays, EVERY_DAY, hasWeekday, maskFromNames, namesFromMask, toggleWeekday, weekdayIndex } from "@/lib/weekdays";

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

describe("weekday bitmask (Mon = 1 … Sun = 64)", () => {
  it("round-trips names and masks", () => {
    expect(maskFromNames(["Mon", "Wed", "Sun"])).toBe(1 + 4 + 64);
    expect(namesFromMask(1 + 4 + 64)).toEqual(["Mon", "Wed", "Sun"]);
    expect(maskFromNames([])).toBe(0);
  });

  it("toggles a day on and off", () => {
    const withoutSunday = toggleWeekday(EVERY_DAY, 64);
    expect(hasWeekday(withoutSunday, 64)).toBe(false);
    expect(toggleWeekday(withoutSunday, 64)).toBe(EVERY_DAY);
  });

  it("names common patterns", () => {
    expect(describeWeekdays(EVERY_DAY)).toBe("Every day");
    expect(describeWeekdays(31)).toBe("Weekdays");
    expect(describeWeekdays(96)).toBe("Weekends");
    expect(describeWeekdays(1 + 16)).toBe("Mon, Fri");
  });
});

describe("calendar dates", () => {
  it("adds days across month ends without timezone drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("indexes weekdays Monday first", () => {
    expect(weekdayIndex("2026-10-19")).toBe(0); // Monday
    expect(weekdayIndex("2026-10-18")).toBe(6); // Sunday
  });

  it("lays dates out in Monday-first month grids", () => {
    const [october] = calendarMonths(["2026-10-18", "2026-10-01"]);
    expect(october.month).toBe("2026-10");
    // 1 Oct 2026 is a Thursday: three blank cells before it.
    expect(october.weeks[0].slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(october.weeks.every((week) => week.length === 7)).toBe(true);
    expect(calendarMonths(["2026-10-30", "2026-11-02"]).map((month) => month.month)).toEqual(["2026-10", "2026-11"]);
  });
});

describe("location", () => {
  it("formats the X-Location header to four decimals", () => {
    expect(locationHeader({ lat: 13.035012, lng: 77.59714 })).toBe("13.0350,77.5971");
    expect(locationHeader(null)).toBeUndefined();
    expect(locationHeader({ lat: 120, lng: 0 })).toBeUndefined();
  });

  it("parses pasted coordinates and rejects nonsense", () => {
    expect(parseLatLng("12.93, 77.55")).toEqual({ lat: 12.93, lng: 77.55 });
    expect(parseLatLng("12.93 77.55")).toEqual({ lat: 12.93, lng: 77.55 });
    expect(parseLatLng("Hebbal")).toBeNull();
    expect(parseLatLng("91, 10")).toBeNull();
  });

  it("finds served areas by pincode", () => {
    expect(presetByPincode("560024")?.name).toBe("Hebbal");
    expect(presetByPincode("110001")).toBeUndefined();
  });

  it("formats distances for people", () => {
    expect(formatDistance(0.04)).toBe("100 m");
    expect(formatDistance(0.75)).toBe("800 m");
    expect(formatDistance(3.24)).toBe("3.2 km");
    expect(formatDistance(14.6)).toBe("15 km");
    expect(formatDistance(null)).toBeNull();
  });
});

const shop = (vendorName: string): Shop => ({
  branchId: "b",
  branchName: "Main",
  vendorId: "v",
  vendorSlug: "s",
  vendorName,
  logoUrl: null,
  isOpen: true,
  statusMessage: null,
  distanceKm: 1,
  deliveryFee: 1500,
  freeDeliveryAbove: null,
  deliverable: true,
});

describe("one shop per cart", () => {
  it("recognises the conflict and names both shops", () => {
    const error = new ApiError(409, "CART_SHOP_CONFLICT", "Cart has another shop", { cartShop: shop("Sharma Dairy"), newShop: shop("Green Basket") });
    const conflict = shopConflict(error);
    expect(conflict?.cartShop?.vendorName).toBe("Sharma Dairy");
    expect(conflictMessage(conflict!)).toContain("Green Basket");
  });

  it("ignores other errors", () => {
    expect(shopConflict(new ApiError(422, "VALIDATION_ERROR", "Bad"))).toBeNull();
    expect(shopConflict(new Error("boom"))).toBeNull();
    expect(isShopUnavailable(new ApiError(409, "SHOP_UNAVAILABLE", "Closed"))).toBe(true);
    expect(isShopUnavailable(new ApiError(409, "CART_SHOP_CONFLICT", "x"))).toBe(false);
  });
});

const message = (id: string, createdAt: string): ChatMessage => ({ id, body: id, senderRole: "VENDOR", mine: false, createdAt, order: null });

describe("chat polling", () => {
  it("merges new messages once, in time order", () => {
    const first = [message("a", "2026-10-18T10:00:00Z")];
    const merged = mergeMessages(first, [message("c", "2026-10-18T10:02:00Z"), message("a", "2026-10-18T10:00:00Z"), message("b", "2026-10-18T10:01:00Z")]);
    expect(merged.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(mergeMessages(merged, [])).toBe(merged);
    expect(lastMessageAt(merged)).toBe("2026-10-18T10:02:00Z");
    expect(lastMessageAt([])).toBeUndefined();
  });
});

describe("document links", () => {
  it("re-points a signed link at the API the phone can reach", () => {
    expect(reachableDocumentUrl("http://localhost:4000/api/v1/documents/download?t=abc.def", "http://192.168.1.5:4000/api/v1/")).toBe(
      "http://192.168.1.5:4000/api/v1/documents/download?t=abc.def",
    );
    expect(reachableDocumentUrl("https://cdn.example.com/x.pdf", "http://api")).toBe("https://cdn.example.com/x.pdf");
  });
});
