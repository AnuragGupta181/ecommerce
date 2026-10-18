/** Pure location helpers: header formatting, manual entry parsing and the preset areas list. */

export type Point = { lat: number; lng: number };

/** ~11 m precision is plenty for distance and fees, and keeps the header short. */
const DECIMALS = 4;

/** Value of the `X-Location` header the backend reads (`<lat>,<lng>`). */
export function locationHeader(point: Point | null): string | undefined {
  if (!point || !isValidPoint(point)) return undefined;
  return `${point.lat.toFixed(DECIMALS)},${point.lng.toFixed(DECIMALS)}`;
}

export function isValidPoint(point: Point): boolean {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

/** Accepts "12.93, 77.55" or "12.93 77.55" as typed or pasted from a maps app. */
export function parseLatLng(text: string): Point | null {
  const parts = text
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map(Number);
  const point = { lat, lng };
  return isValidPoint(point) ? point : null;
}

export function formatDistance(km: number | null | undefined): string | null {
  if (km === null || km === undefined) return null;
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export type PresetArea = Point & { name: string; pincode: string };

/** The areas the launch shops serve; picking one is the no-GPS fallback. */
export const PRESET_AREAS: PresetArea[] = [
  { name: "Hebbal", pincode: "560024", lat: 13.035, lng: 77.597 },
  { name: "Banashankari", pincode: "560050", lat: 12.935, lng: 77.555 },
  { name: "MG Road", pincode: "560001", lat: 12.9756, lng: 77.6066 },
  { name: "Indiranagar", pincode: "560038", lat: 12.9784, lng: 77.6408 },
  { name: "Koramangala", pincode: "560034", lat: 12.9352, lng: 77.6245 },
  { name: "Jayanagar", pincode: "560041", lat: 12.925, lng: 77.5938 },
  { name: "Malleshwaram", pincode: "560003", lat: 13.0035, lng: 77.5709 },
  { name: "Whitefield", pincode: "560066", lat: 12.9698, lng: 77.75 },
];

export function presetByPincode(pincode: string): PresetArea | undefined {
  return PRESET_AREAS.find((area) => area.pincode === pincode.trim());
}
