"use server";

import type { BranchInput } from "@/lib/marketplace-types";
import { runAction } from "@/lib/server/action";
import { publicApi } from "@/lib/server/api";

export type SignupInput = {
  owner: { name: string; email: string; phone: string; password: string };
  shop: { shopName: string; phone: string; email: string; address: string; description: string; gstin: string | null; idProofType: string | null; idProofNumber: string | null };
  branch: BranchInput;
};

/** Public: the shop starts PENDING and the owner can sign in to set up stock while Haat reviews it. */
export async function signupVendor(input: SignupInput) {
  return runAction(() => publicApi.post<{ vendor: { id: string; status: string } }>("/vendors/signup", input));
}
