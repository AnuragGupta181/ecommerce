import Image from "next/image";

/** Everyday groceries around the edges of the sign-in and signup pages. Decorative only. */
const ITEMS = [
  { src: "/auth/milk.webp", className: "-left-10 top-10 size-56 -rotate-12" },
  { src: "/auth/eggs.webp", className: "-right-12 top-6 size-60 rotate-6" },
  { src: "/auth/strawberry.webp", className: "-left-14 bottom-0 size-64 rotate-12" },
  { src: "/auth/lemon.webp", className: "-right-10 -bottom-6 size-56 -rotate-6" },
];

export function ProduceBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden bg-brand-100">
      {ITEMS.map((item) => (
        <Image key={item.src} src={item.src} alt="" width={256} height={256} priority className={`absolute hidden object-contain opacity-90 sm:block ${item.className}`} />
      ))}
    </div>
  );
}
