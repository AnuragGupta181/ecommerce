import { z } from "zod";

export const brandInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  logoUrl: z.string().trim().url().nullish(),
  isActive: z.boolean().default(true),
});

export const brandUpdateSchema = brandInputSchema.partial();

export type BrandInput = z.infer<typeof brandInputSchema>;
export type BrandUpdate = z.infer<typeof brandUpdateSchema>;
