import { ImageOff } from "lucide-react";

/** Product imagery sits on canvas with contain fit so it is never cropped (docs/DESIGN.md). */
export function Thumb({ src, alt, size = 40 }: { src: string | null; alt: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas" style={{ width: size, height: size }}>
      {src ? (
        // Catalog images come from arbitrary hosts and are already sized; next/image adds nothing here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="size-full object-contain" loading="lazy" />
      ) : (
        <ImageOff size={size / 2.5} className="text-ink-300" />
      )}
    </span>
  );
}
