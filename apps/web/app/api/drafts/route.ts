import { NextResponse, type NextRequest } from "next/server";

import { parseTarget, upsertFormDraft } from "@/lib/drafts/store";
import { createServerClient } from "@/lib/supabase/server";

// Beacon endpoint for flushing the live draft on page unload, where a Server
// Action can't reliably run. `navigator.sendBeacon` POSTs a JSON blob here; the
// user is resolved from the session cookie and RLS still scopes the write.
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    target?: unknown;
    payload?: unknown;
  } | null;
  const target = parseTarget(body?.target);
  if (!body || !target || !("payload" in body)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await upsertFormDraft(supabase, user.id, target, body.payload);
  return NextResponse.json(result);
}
