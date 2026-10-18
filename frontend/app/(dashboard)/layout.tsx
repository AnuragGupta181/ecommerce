import { Suspense } from "react";
import { PageBackdrop } from "@/components/layout/page-backdrop";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/** Static chrome: prerendered into the shell, while each page streams its data behind Suspense. */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative isolate flex min-h-screen">
      {/* Reads the URL, so it sits behind Suspense (cacheComponents); renders nothing until then. */}
      <Suspense>
        <PageBackdrop />
      </Suspense>
      <Sidebar portal="admin" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar portal="admin" />
        <main className="mx-auto w-full max-w-[1280px] flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
