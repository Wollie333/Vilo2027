import { NextResponse } from "next/server";

import { drainLookingForNotifications } from "@/lib/looking-for/notifications-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function authorised(req: Request): boolean {
  // Reuses the email-worker bearer secret (Vault email_worker_secret).
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const result = await drainLookingForNotifications();
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, error: { code: "LOOKING_FOR_WORKER_FAILED", message } },
      { status: 500 },
    );
  }
}
