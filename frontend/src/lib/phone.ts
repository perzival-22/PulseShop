/**
 * Normalizes a Kenyan phone number to bare digits in international form
 * (2547XXXXXXXX / 2541XXXXXXXX) — the format wa.me links require. Accepts
 * "+254 712 345 678", "0712345678", "254712345678", etc.
 */
export function toWhatsAppDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

/** Strips a leading "@" or a full profile URL down to the bare handle. */
export function toSocialHandle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const lastSegment = trimmed.includes("/")
    ? (trimmed.split("/").filter(Boolean).pop() ?? trimmed)
    : trimmed;
  return lastSegment.replace(/^@/, "");
}
