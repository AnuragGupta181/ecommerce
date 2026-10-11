"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireAdmin } from "@/lib/server/session";
import type { RiderInput } from "@/lib/types";

/** Empty optional fields go to the API as null so they clear stored values. */
function clean(input: RiderInput): RiderInput {
  const blankToNull = (value: string | null) => (value?.trim() ? value.trim() : null);
  return {
    ...input,
    whatsapp: blankToNull(input.whatsapp),
    email: blankToNull(input.email),
    vehicleNumber: blankToNull(input.vehicleNumber),
    idProofType: blankToNull(input.idProofType),
    idProofNumber: blankToNull(input.idProofNumber),
    address: blankToNull(input.address),
    notes: blankToNull(input.notes),
  };
}

export async function saveRider(id: string | null, input: RiderInput) {
  await requireAdmin();
  return runAction(async () => {
    if (id) await api.patch(`/admin/riders/${id}`, clean(input));
    else await api.post("/admin/riders", clean(input));
    revalidatePath("/riders");
    if (id) revalidatePath(`/riders/${id}`);
  });
}

export async function deleteRider(id: string) {
  await requireAdmin();
  return runAction(async () => {
    const result = await api.delete<{ archived: boolean }>(`/admin/riders/${id}`);
    revalidatePath("/riders");
    return result;
  });
}
