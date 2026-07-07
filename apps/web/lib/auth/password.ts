import { z } from "zod";

// Shared password policy for every account-creation surface (host signup,
// guest signup, staff-invite /register, password reset). One source of truth
// so the rules can't drift between flows.
//
// Layers:
//  1. `passwordSchema` (sync, client + server) — length + common-list +
//     minimum variety. Cheap, runs in the browser for instant feedback.
//  2. `isBreachedPassword` (async, SERVER ONLY) — Have I Been Pwned
//     k-anonymity range check. Best-effort: any network error resolves to
//     `false` so a HIBP outage can never block a legitimate signup.
//  3. `scorePassword` — a lightweight 0–4 strength estimate that drives the
//     client strength meter (no zxcvbn dependency / bundle cost).

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // bcrypt truncates past 72 bytes.

// The ~100 most-abused passwords (leaked-list intersection). Lower-cased.
// Kept deliberately small — the HIBP check is the real breach net; this is the
// zero-latency guard that catches the worst offenders offline / in dev.
const COMMON_PASSWORDS = new Set<string>([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "123123123",
  "111111111",
  "qwertyuiop",
  "qwerty123",
  "1q2w3e4r",
  "1qaz2wsx",
  "abc12345",
  "abcd1234",
  "iloveyou",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "welcome1",
  "welcome123",
  "admin123",
  "letmein1",
  "monkey12",
  "trustno1",
  "dragon123",
  "master123",
  "shadow123",
  "superman",
  "michael1",
  "jennifer",
  "computer",
  "whatever",
  "starwars",
  "changeme",
  "changeme123",
  "secret123",
  "qazwsxedc",
  "asdfghjkl",
  "zxcvbnm1",
  "password!",
  "p@ssword",
  "p@ssw0rd",
  "wielo123",
  "booking123",
  "southafrica",
  "capetown1",
]);

function normalise(pw: string): string {
  return pw.trim().toLowerCase();
}

/** True when the password is on the common-abuse list. */
export function isCommonPassword(pw: string): boolean {
  return COMMON_PASSWORDS.has(normalise(pw));
}

/** Count how many character classes appear (lower/upper/digit/symbol). */
function characterClasses(pw: string): number {
  let classes = 0;
  if (/[a-z]/.test(pw)) classes += 1;
  if (/[A-Z]/.test(pw)) classes += 1;
  if (/\d/.test(pw)) classes += 1;
  if (/[^A-Za-z0-9]/.test(pw)) classes += 1;
  return classes;
}

/** All-one-character ("aaaaaaaa") or a short repeated unit ("abcabcabc"). */
function isTrivialPattern(pw: string): boolean {
  if (/^(.)\1+$/.test(pw)) return true; // one repeated char
  if (/^(..?.?.?)\1+$/.test(pw)) return true; // a short unit tiled to length
  return false;
}

/**
 * Sync validation shared by every password field. Runs client-side (instant
 * error) and again server-side inside the Zod-parsed action, so a hand-crafted
 * request can't bypass it.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, "Password is too long.")
  .refine((pw) => !isCommonPassword(pw), {
    message: "That password is too common — pick something less guessable.",
  })
  .refine((pw) => !isTrivialPattern(pw), {
    message: "Avoid repeated or sequential patterns.",
  })
  .refine((pw) => characterClasses(pw) >= 2, {
    message: "Mix letters with a number or symbol.",
  });

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Good" | "Strong";
};

const STRENGTH_LABELS: PasswordStrength["label"][] = [
  "Very weak",
  "Weak",
  "Fair",
  "Good",
  "Strong",
];

/**
 * Lightweight 0–4 strength estimate for the UI meter. Not a substitute for the
 * schema/breach checks — purely to give the user live "getting stronger"
 * feedback. Rewards length and character variety, punishes common/trivial.
 */
export function scorePassword(
  pw: string,
  opts?: { email?: string },
): PasswordStrength {
  if (!pw) return { score: 0, label: STRENGTH_LABELS[0] };

  const emailLocal = opts?.email?.split("@")[0]?.toLowerCase() ?? "";
  const lower = pw.toLowerCase();
  if (isCommonPassword(pw) || isTrivialPattern(pw)) {
    return { score: 0, label: STRENGTH_LABELS[0] };
  }
  if (emailLocal.length >= 3 && lower.includes(emailLocal)) {
    return { score: 1, label: STRENGTH_LABELS[1] };
  }

  let score = 0;
  if (pw.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;
  const classes = characterClasses(pw);
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;

  const clamped = Math.min(4, score) as PasswordStrength["score"];
  return { score: clamped, label: STRENGTH_LABELS[clamped] };
}

/**
 * Server-only Have I Been Pwned check via the k-anonymity range API. We hash
 * the password with SHA-1, send only the first 5 hex chars, and match the
 * suffix locally — the full password never leaves the process.
 *
 * Best-effort by design: a timeout, non-200, or any thrown error resolves to
 * `false` (treat as not-breached) so an HIBP outage can never lock a real user
 * out of signing up. Only a positive match with a real breach count rejects.
 */
export async function isBreachedPassword(pw: string): Promise<boolean> {
  try {
    const data = new TextEncoder().encode(pw);
    const digest = await crypto.subtle.digest("SHA-1", data);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [lineSuffix, countStr] = line.trim().split(":");
      if (lineSuffix === suffix) {
        const count = Number.parseInt(countStr ?? "0", 10);
        return count > 0;
      }
    }
    return false;
  } catch {
    return false;
  }
}
