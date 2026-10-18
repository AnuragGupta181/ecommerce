"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const expired = searchParams.get("expired") === "1";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />
      {state.error || expired ? (
        <p role="alert" className="rounded-control bg-danger-soft px-3 py-2.5 text-danger">
          {state.error ?? "Your session ended. Please sign in again."}
        </p>
      ) : null}
      <Field label="Email or phone" htmlFor="identifier">
        <Input id="identifier" name="identifier" autoComplete="username" defaultValue={state.identifier} required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" pending={pending} className="mt-2 w-full">
        Sign in
      </Button>
    </form>
  );
}
