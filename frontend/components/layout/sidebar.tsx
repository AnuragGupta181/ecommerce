import Link from "next/link";
import { Suspense } from "react";
import { NavList, SidebarNav } from "./sidebar-nav";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
      <Link href="/" className="flex h-16 items-center gap-2.5 border-b border-line px-6">
        <span className="flex size-8 items-center justify-center rounded-lg bg-brand-500 text-base font-extrabold text-ink-900">H</span>
        <span className="text-base font-bold">
          Haat <span className="font-semibold text-ink-500">Admin</span>
        </span>
      </Link>
      <Suspense fallback={<NavList pathname={null} />}>
        <SidebarNav />
      </Suspense>
    </aside>
  );
}
