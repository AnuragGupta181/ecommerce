/**
 * Normalises an Indian mobile number to E.164 (+91XXXXXXXXXX).
 * Numbers that already carry another country code are kept as-is.
 */
export function toE164(phone: string, defaultCountryCode = "91"): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+${defaultCountryCode}${digits.slice(1)}`;
  return `+${digits}`;
}

/** Click-to-chat link with a pre-filled message (used when no WhatsApp API is configured). */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${toE164(phone).slice(1)}?text=${encodeURIComponent(text)}`;
}
