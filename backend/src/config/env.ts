import { z } from "zod";

const booleanString = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((value) => value === "true" || value === "1");

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  PUBLIC_URL: z.url().default("http://localhost:4000"),
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  DATABASE_URL: z.string().min(1),
  /** Set to ipv4first on networks where IPv6 to the database hangs (ipv6first for the reverse). */
  DB_DNS_ORDER: z.enum(["ipv4first", "ipv6first", "verbatim"]).optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: booleanString,
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  MAIL_FROM: z.string().default("Haat <no-reply@haat.local>"),

  WHATSAPP_PROVIDER: z.enum(["meta", "twilio", "log"]).default("log"),
  WHATSAPP_META_TOKEN: optionalString,
  WHATSAPP_META_PHONE_ID: optionalString,
  TWILIO_ACCOUNT_SID: optionalString,
  TWILIO_AUTH_TOKEN: optionalString,
  TWILIO_WHATSAPP_FROM: optionalString,

  UPLOAD_DIR: z.string().default("uploads"),
  UPLOAD_MAX_MB: z.coerce.number().positive().default(5),
  /** local (dev disk) | cloudinary | vercel-blob (Vercel) | s3 (Render, AWS, R2 …) */
  STORAGE_DRIVER: z.enum(["local", "cloudinary", "vercel-blob", "s3"]).default("local"),
  /** cloudinary://<api_key>:<api_secret>@<cloud_name> */
  CLOUDINARY_URL: optionalString,
  BLOB_READ_WRITE_TOKEN: optionalString,
  S3_BUCKET: optionalString,
  S3_REGION: z.string().default("ap-south-1"),
  /** Only for S3-compatible services (R2, B2, MinIO); empty for AWS S3. */
  S3_ENDPOINT: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  /** Public base URL objects are served from (bucket URL or CDN). */
  S3_PUBLIC_URL: optionalString,
  /** Long-running servers (Render, AWS): run the daily job in-process at 18:00 IST. Off on Vercel. */
  ENABLE_SCHEDULER: booleanString,

  /** Straight-line km × this ≈ road km, used when no routing key is set. */
  ROAD_FACTOR: z.coerce.number().min(1).max(3).default(1.3),
  ORS_API_KEY: optionalString,
  CRON_SECRET: optionalString,
  PORTAL_URL: z.url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${issues.join("\n")}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
