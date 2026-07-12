import { z } from "zod";

/**
 * Password rules. These MUST stay in step with Supabase (Auth → Password
 * settings: minimum length + "Password Requirements"), which is the real
 * enforcement — everything here is a client-side mirror so the user finds out
 * what's wrong *while typing* instead of via a rejected request.
 *
 * Supabase is set to require lowercase + uppercase + digits + symbols.
 *
 * Deliberately not applied to the LOGIN form: an existing account may have been
 * created under the old 6-character rule, and validating a sign-in against the
 * new rules would lock those users out client-side, before Supabase ever gets a
 * chance to accept their (perfectly valid) existing password. Rules belong on
 * the forms that *set* a password, never the one that checks it.
 */
export const PASSWORD_MIN_LENGTH = 10;

/**
 * Supabase's default symbol set, character for character. Matching "any
 * non-alphanumeric" instead would be a superset — a space or an emoji would
 * tick the box here and then be rejected server-side, which is exactly the
 * all-green-but-refused confusion this checklist exists to prevent.
 */
const SYMBOL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|<>?,./`~]/;

export interface PasswordCheck {
  label: string;
  met: boolean;
}

/** The live checklist shown under the password field. */
export function passwordChecks(value: string): PasswordCheck[] {
  const v = value ?? "";
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: v.length >= PASSWORD_MIN_LENGTH },
    { label: "A lowercase letter", met: /[a-z]/.test(v) },
    { label: "An uppercase letter", met: /[A-Z]/.test(v) },
    { label: "A number", met: /[0-9]/.test(v) },
    { label: "A special character", met: SYMBOL_RE.test(v) },
  ];
}

export const isPasswordValid = (value: string) => passwordChecks(value).every((c) => c.met);

/** Zod schema for any form that SETS a password (signup, and a future reset). */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `At least ${PASSWORD_MIN_LENGTH} characters`)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/[0-9]/, "Add a number")
  .regex(SYMBOL_RE, "Add a special character");
