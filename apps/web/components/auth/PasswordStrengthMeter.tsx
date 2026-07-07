"use client";

import { useMemo } from "react";

import { scorePassword } from "@/lib/auth/password";

// Live password strength bar for signup / register forms. Purely advisory —
// the real gates are `passwordSchema` (sync) + the server breach check. Renders
// nothing for an empty field so it doesn't clutter the initial state.

const BAR_COLORS = [
  "bg-red-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-brand-primary",
] as const;

const TEXT_COLORS = [
  "text-red-600",
  "text-red-600",
  "text-amber-600",
  "text-lime-600",
  "text-brand-primary",
] as const;

export function PasswordStrengthMeter({
  password,
  email,
  className,
}: {
  password: string;
  email?: string;
  className?: string;
}) {
  const { score, label } = useMemo(
    () => scorePassword(password, { email }),
    [password, email],
  );

  if (!password) return null;

  return (
    <div className={className}>
      <div className="mt-2 flex items-center gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? BAR_COLORS[score] : "bg-brand-line"
            }`}
          />
        ))}
      </div>
      <div className={`mt-1 text-[11px] font-medium ${TEXT_COLORS[score]}`}>
        Password strength: {label}
      </div>
    </div>
  );
}
