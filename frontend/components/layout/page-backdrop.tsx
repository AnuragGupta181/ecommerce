"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * Faint grocery photos behind each portal page, themed to what the page is about. Decorative only:
 * fixed in the bottom-right corner, behind the content, no pointer events, hidden from screen readers.
 */
const THEMES: { match: RegExp; photos: [string, string] }[] = [
  { match: /\/(orders|counter)/, photos: ["rice", "potatoes"] },
  { match: /\/(subscriptions|plans|deliveries)/, photos: ["milk", "eggs"] },
  { match: /\/(stock|inventory|products|categories|brands)/, photos: ["green-bell-pepper", "red-onions"] },
  { match: /\/(tickets|messages|reviews|notifications)/, photos: ["lemon", "kiwi"] },
  { match: /\/(payouts|reports|audit)/, photos: ["nescafe-coffee", "water"] },
  { match: /\/(coupons|banners)/, photos: ["honey-jar", "mulberry"] },
  { match: /\/(vendors|shop|riders|customers|admins|settings)/, photos: ["cucumber", "juice"] },
];
const DASHBOARD: [string, string] = ["strawberry", "ice-cream"];

export function PageBackdrop() {
  const pathname = usePathname();
  const [large, small] = THEMES.find((theme) => theme.match.test(pathname))?.photos ?? DASHBOARD;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden md:block">
      <Image src={`/backdrop/${large}.webp`} alt="" width={320} height={320} className="absolute -right-16 -bottom-16 size-80 -rotate-12 object-contain opacity-[0.12]" />
      <Image src={`/backdrop/${small}.webp`} alt="" width={200} height={200} className="absolute top-1/3 right-[22%] size-48 rotate-12 object-contain opacity-[0.07]" />
    </div>
  );
}
