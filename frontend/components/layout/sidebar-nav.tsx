"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, navGroups } from "./nav-items";

export function SidebarNav() {
  return <NavList pathname={usePathname()} />;
}

/** Also rendered without a pathname as the Suspense fallback, since dynamic routes only know the URL at request time. */
export function NavList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-ink-500 uppercase">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname !== null && isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex h-9 items-center gap-3 rounded-[10px] px-3 transition-colors ${
                      active ? "bg-brand-100 text-ink-900" : "text-ink-700 hover:bg-brand-50"
                    }`}
                  >
                    {active ? <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand-600" /> : null}
                    <Icon size={18} strokeWidth={1.75} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
