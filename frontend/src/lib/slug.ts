/** Shop handle rules — must match the `merchants.handle` unique constraint. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const SLUG_MIN_LENGTH = 3;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function slugError(value: string): string | null {
  const v = value.trim();
  if (v.length < SLUG_MIN_LENGTH) return `At least ${SLUG_MIN_LENGTH} characters`;
  if (!SLUG_PATTERN.test(v)) return "Lowercase letters, numbers and dashes only";
  return null;
}
