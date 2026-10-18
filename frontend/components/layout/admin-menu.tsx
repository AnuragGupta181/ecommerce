import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/login/actions";
import { getPortalProfile } from "@/lib/server/session";

/** Reads the session cookie, so it renders behind a Suspense boundary in the top bar. */
export async function AdminMenu() {
  const admin = await getPortalProfile();
  const subtitle = admin.role === "VENDOR" ? (admin.vendorRole === "STAFF" ? "Shop staff" : "Shop owner") : admin.isSuperAdmin ? "Super admin" : admin.email;
  const initials = admin.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-ink-900">{initials}</span>
      <div className="hidden leading-tight sm:block">
        <p className="font-semibold">{admin.name}</p>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
      <form action={logout}>
        <button type="submit" className="flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-brand-50 hover:text-ink-900" aria-label="Log out" title="Log out">
          <LogOut size={18} strokeWidth={1.75} />
        </button>
      </form>
    </div>
  );
}
