import type { Settings } from "../../generated/prisma/client.js";
import { prisma, type Db } from "../../lib/prisma.js";
import type { UpdateSettingsInput } from "./settings.schema.js";

const SETTINGS_ID = 1;

/**
 * Settings are read on almost every pricing call but change rarely. A short per-instance cache
 * saves a database round trip each time; saves through updateSettings refresh it immediately,
 * and other server instances pick the change up within the TTL.
 */
const CACHE_TTL_MS = 30_000;
let cached: { value: Settings; expiresAt: number } | null = null;

function remember(value: Settings): Settings {
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function getSettings(db: Db = prisma): Promise<Settings> {
  // Only the shared client is cached; a caller passing its own transaction reads what it sees.
  const shared = db === prisma;
  if (shared && cached && cached.expiresAt > Date.now()) return cached.value;
  // Read first; only a brand-new database needs the row created.
  const row = (await db.settings.findUnique({ where: { id: SETTINGS_ID } })) ?? (await db.settings.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } }));
  return shared ? remember(row) : row;
}

/** Settings safe to expose to shoppers. */
export async function getPublicSettings() {
  const s = await getSettings();
  return {
    storeName: s.storeName,
    supportEmail: s.supportEmail,
    supportPhone: s.supportPhone,
    deliveryFee: s.deliveryFee,
    freeDeliveryThreshold: s.freeDeliveryThreshold,
    coinEarnPer100: s.coinEarnPer100,
    coinMaxRedeemPercent: s.coinMaxRedeemPercent,
    returnWindowDays: s.returnWindowDays,
    codEnabled: s.codEnabled,
    upiOnDeliveryEnabled: s.upiOnDeliveryEnabled,
    referralEnabled: s.referralEnabled,
    referralReferrerCoins: s.referralReferrerCoins,
    referralRefereeCoins: s.referralRefereeCoins,
  };
}

export async function updateSettings(input: UpdateSettingsInput) {
  return remember(
    await prisma.settings.upsert({
      where: { id: SETTINGS_ID },
      update: input,
      create: { id: SETTINGS_ID, ...input },
    }),
  );
}
