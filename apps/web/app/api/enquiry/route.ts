import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createEnquiry } from "@/lib/enquiry/create-enquiry";
import { createServerClient } from "@/lib/supabase/server";

// Public "request a quote" endpoint. Deliberately a Route Handler rather than a
// Server Action: a route handler controls its own JSON response, so any error
// (including a server-side throw) is returned to the client verbatim instead of
// being collapsed into an opaque, unactionable 500. The handler itself never
// throws — every failure path returns a 200 with `{ ok: false, error }` so the
// browser always receives a parseable body.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request — could not read the form data." },
      { status: 200 },
    );
  }

  try {
    const result = await createEnquiry(body);
    if (result.ok) {
      revalidatePath("/dashboard/inbox");
      // If the visitor is already signed in, skip the magic-link / login bounce
      // that createEnquiry returns (it's written for anonymous leads) and send
      // them straight to the enquiry thread in their portal inbox.
      if (result.data.conversationId) {
        const supabase = createServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          result.data.redirectTo = `/portal/inbox/${result.data.conversationId}`;
        }
      }
    }
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    // Surface the real reason. Pre-MVP there are no real users to protect from
    // the detail, and it's the only way to diagnose a server-side failure
    // without trawling Vercel logs.
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json(
      {
        ok: false,
        error: `Couldn't send your request — ${message}`,
        // Stack only in non-production — never leak server internals publicly.
        ...(process.env.NODE_ENV !== "production"
          ? { detail: e instanceof Error ? (e.stack ?? e.message) : String(e) }
          : {}),
      },
      { status: 200 },
    );
  }
}
