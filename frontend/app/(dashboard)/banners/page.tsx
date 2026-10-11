import type { Metadata } from "next";
import { Suspense } from "react";
import { BannerManager } from "@/components/marketing/banner-manager";
import { PageHeader } from "@/components/ui/page-header";
import { TableSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/server/api";
import type { Banner } from "@/lib/types";

export const metadata: Metadata = { title: "Banners" };

export default function BannersPage() {
  return (
    <>
      <PageHeader title="Banners" description="Home carousel slides and offer strips in the app" />
      <Suspense fallback={<TableSkeleton />}>
        <Banners />
      </Suspense>
    </>
  );
}

async function Banners() {
  return <BannerManager banners={await api.get<Banner[]>("/admin/banners")} />;
}
