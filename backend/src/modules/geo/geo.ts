import type { Request } from "express";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

export type Point = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;
const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in km. Under 0.5% error at delivery distances. */
export function haversineKm(from: Point, to: Point): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Roads are rarely straight: scale the crow-flies distance to approximate the ride. */
export function approxRoadKm(from: Point, to: Point, roadFactor = env.ROAD_FACTOR): number {
  return round1(haversineKm(from, to) * roadFactor);
}

export const round1 = (km: number) => Math.round(km * 10) / 10;

export function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as Record<string, unknown>;
  return typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** "12.97,77.59" → point; anything malformed → null. */
export function parsePoint(raw: unknown): Point | null {
  if (typeof raw !== "string") return null;
  const [lat, lng] = raw.split(",").map((part) => Number(part.trim()));
  const point = { lat: lat ?? NaN, lng: lng ?? NaN };
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && isPoint(point) ? point : null;
}

/** The shopper's browsing location: `X-Location` header, else `?lat=&lng=`. */
export function requestPoint(req: Request): Point | null {
  const header = parsePoint(req.header("x-location"));
  if (header) return header;
  const { lat, lng } = req.query;
  return typeof lat === "string" && typeof lng === "string" ? parsePoint(`${lat},${lng}`) : null;
}

// ───────────────────────── road distance (optional) ─────────────────────────

const roadCache = new Map<string, number>();
const cacheKey = (from: Point, to: Point) => [from.lat, from.lng, to.lat, to.lng].map((n) => n.toFixed(4)).join(",");

/**
 * Road distance from OpenRouteService when `ORS_API_KEY` is set; the approximation otherwise
 * or whenever the service is slow or fails, so checkout never depends on a third party.
 */
export async function deliveryDistanceKm(from: Point, to: Point): Promise<number> {
  if (!env.ORS_API_KEY) return approxRoadKm(from, to);
  const key = cacheKey(from, to);
  const cached = roadCache.get(key);
  if (cached !== undefined) return cached;
  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?start=${from.lng},${from.lat}&end=${to.lng},${to.lat}`;
    const res = await fetch(url, { headers: { Authorization: env.ORS_API_KEY }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`ORS ${res.status}`);
    const json = (await res.json()) as { features?: { properties?: { summary?: { distance?: number } } }[] };
    const meters = json.features?.[0]?.properties?.summary?.distance;
    if (typeof meters !== "number") throw new Error("ORS: no distance");
    const km = round1(meters / 1000);
    if (roadCache.size > 5000) roadCache.clear();
    roadCache.set(key, km);
    return km;
  } catch (error) {
    logger.warn({ err: error }, "Road distance unavailable; using approximation");
    return approxRoadKm(from, to);
  }
}

/** Google Maps link for a point (riders and shop pages). */
export const mapsLink = (point: Point) => `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
