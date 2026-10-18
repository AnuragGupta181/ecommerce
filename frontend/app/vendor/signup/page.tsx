import type { Metadata } from "next";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Sell on Haat" };

export default function VendorSignupPage() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-brand-500 text-lg font-extrabold text-ink-900">H</span>
          <div>
            <h1 className="text-xl leading-tight font-bold">Sell on Haat</h1>
            <p className="text-ink-500">Reach customers near your shop. You set your prices, stock and delivery charges.</p>
          </div>
        </div>
        <SignupForm />
      </div>
    </main>
  );
}
