import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-card border border-line bg-surface p-8">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500 text-lg font-extrabold text-ink-900">H</span>
          <div>
            <p className="text-lg leading-tight font-bold">Haat Admin</p>
            <p className="text-xs text-ink-500">Sign in to manage your store</p>
          </div>
        </div>
        {/* The form reads ?next and ?expired, which only exist at request time. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
