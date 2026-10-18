"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/server/action";
import { api } from "@/lib/server/api";
import { requireVendor } from "@/lib/server/session";
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

export async function saveVendorRider(id: string | null, input: RiderInput) {
  await requireVendor();
  return runAction(async () => {
    if (id) await api.patch(`/vendor/riders/${id}`, clean(input));
    else await api.post("/vendor/riders", clean(input));
    revalidatePath("/vendor/riders");
  });
}

export async function deleteVendorRider(id: string) {
  await requireVendor();
  return runAction(async () => {
    const result = await api.delete<{ archived: boolean }>(`/vendor/riders/${id}`);
    revalidatePath("/vendor/riders");
    return result;
  });
}

/** Emails the rider their private schedule page and returns a WhatsApp link to send it by hand. */
export async function sendScheduleLink(riderId: string) {
  await requireVendor();
  return runAction(() => api.post<{ url: string; whatsapp: string | null }>(`/vendor/deliveries/riders/${riderId}/send-link`));
}
