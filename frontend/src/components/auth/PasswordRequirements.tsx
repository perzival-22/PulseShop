import { Check, Circle } from "lucide-react";
import { passwordChecks } from "@/lib/password";
import { cn } from "@/lib/utils";

/**
 * Live checklist under the password field: every rule, ticking green as it's
 * met. Shown while the field is focused or holds anything, so the user can see
 * what's still missing *as they type* rather than being told after a failed
 * submit — and never sees an all-green password get rejected, because these
 * rules mirror Supabase's exactly (see lib/password.ts).
 */
export function PasswordRequirements({ value, show }: { value: string; show: boolean }) {
  if (!show) return null;

  const checks = passwordChecks(value);
  const metCount = checks.filter((c) => c.met).length;

  return (
    <div
      className="mt-2 rounded-xl bg-stone-50 p-3"
      // Announce progress without spamming a screen reader on every keystroke.
      aria-live="polite"
    >
      <p className="sr-only">
        Password meets {metCount} of {checks.length} requirements.
      </p>
      <ul className="space-y-1.5">
        {checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.met ? (
              <Check className="size-3.5 shrink-0 text-success" aria-hidden />
            ) : (
              <Circle className="size-3.5 shrink-0 text-stone-300" aria-hidden />
            )}
            <span
              className={cn(
                "text-xs font-medium transition-colors",
                c.met ? "text-success" : "text-muted",
              )}
            >
              {c.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
