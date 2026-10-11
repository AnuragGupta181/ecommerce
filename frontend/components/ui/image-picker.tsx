"use client";

import { Upload, X } from "lucide-react";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/server/upload-action";
import { Thumb } from "./thumb";

/** Single image field: upload a file or paste a URL. */
export function ImagePicker({ value, onChange, label = "Image" }: { value: string; onChange: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();

  function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const result = await uploadImage(form);
      if (result.ok) onChange(result.data.url);
      else toast.error(result.message);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Thumb src={value || null} alt={label} size={56} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://… or upload"
          className="h-9 w-full rounded-control border border-line px-3 text-sm focus:border-brand-600 focus:outline-none"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline disabled:opacity-50">
            <Upload size={14} /> {pending ? "Uploading…" : "Upload"}
          </button>
          {value ? (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:underline">
              <X size={14} /> Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
