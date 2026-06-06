import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

// Public one-click unsubscribe (no login). POPIA: irreversible by the host —
// only the guest (here) or the guest's own re-subscribe can flip it back.
//   GET  → flip + friendly confirmation page (link in the email footer)
//   POST → RFC 8058 List-Unsubscribe-Post one-click (mail clients)
export const dynamic = "force-dynamic";

async function unsubscribe(token: string): Promise<"ok" | "notfound"> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("guest_marketing")
    .select("host_id, gkey")
    .eq("unsub_token", token)
    .maybeSingle();
  if (!data) return "notfound";

  await admin
    .from("guest_marketing")
    .update({ is_subscribed: false, unsubscribed_at: new Date().toISOString() })
    .eq("unsub_token", token);
  return "ok";
}

function page(title: string, message: string, status: number): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F0FDF4;font-family:Inter,Arial,sans-serif;color:#052E1F">
  <div style="max-width:420px;margin:24px;padding:32px;background:#fff;border:1px solid #DCEAE0;border-radius:16px;text-align:center">
    <div style="font-size:18px;font-weight:700;color:#064E3B">${title}</div>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#4A7C6A">${message}</p>
  </div>
</body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const result = await unsubscribe(params.token);
  if (result === "notfound") {
    return page(
      "Link not recognised",
      "This unsubscribe link is invalid or has expired. If you keep receiving emails, reply and ask to be removed.",
      404,
    );
  }
  return page(
    "You're unsubscribed",
    "You won't receive any more marketing emails from this host. You can still receive booking-related messages.",
    200,
  );
}

export async function POST(
  _req: Request,
  { params }: { params: { token: string } },
) {
  const result = await unsubscribe(params.token);
  return NextResponse.json(
    { ok: result === "ok" },
    { status: result === "ok" ? 200 : 404 },
  );
}
