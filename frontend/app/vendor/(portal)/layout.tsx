import { Suspense } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/** The shop owner's portal: same chrome as the admin, scoped to one shop by the backend. */
export default function VendorLayout({ children }: LayoutProps<"/vendor">) {
  return (
    <div className="relative isolate flex min-h-screen">
      {/* Reads the URL, so it sits behind Suspense (cacheComponents); renders nothing until then. */}
      <Suspense>
        <PageBackdrop />
      </Suspense>
      <Sidebar portal="vendor" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar portal="vendor" />
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
