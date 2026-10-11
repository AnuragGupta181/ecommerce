"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

type Result<T> = { ok: true; data: T } | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Runs a Server Action from a client form: tracks pending state, keeps field errors
 * for inline display and reports the outcome as a toast.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function run<T>(action: () => Promise<Result<T>>, options: { success?: string; onSuccess?: (data: T) => void } = {}) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setFieldErrors({});
        if (options.success) toast.success(options.success);
        options.onSuccess?.(result.data);
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.message);
      }
    });
  }

  return { pending, fieldErrors, setFieldErrors, run };
}
