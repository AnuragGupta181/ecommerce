const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** Money is integer paise from the API; this is the only place it becomes rupees. */
export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}
