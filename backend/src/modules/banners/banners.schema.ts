import { z } from "zod";

const bannerBase = z.object({
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(160).nullish(),
  imageUrl: z.string().trim().min(1),
  linkType: z.enum(["NONE", "PRODUCT", "CATEGORY", "SEARCH", "URL"]).default("NONE"),
  linkValue: z.string().trim().max(300).nullish(),
  placement: z.enum(["HOME_CAROUSEL", "HOME_STRIP"]).default("HOME_CAROUSEL"),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
});

type BannerShape = Partial<z.infer<typeof bannerBase>>;

const linkRule = (banner: BannerShape, ctx: z.RefinementCtx) => {
  if (banner.linkType && banner.linkType !== "NONE" && !banner.linkValue) {
    ctx.addIssue({ code: "custom", path: ["linkValue"], message: "Link target is required for this link type" });
  }
};

export const bannerInputSchema = bannerBase.superRefine(linkRule);
export const bannerUpdateSchema = bannerBase.partial().superRefine(linkRule);

export type BannerInput = z.infer<typeof bannerInputSchema>;
export type BannerUpdate = z.infer<typeof bannerUpdateSchema>;
