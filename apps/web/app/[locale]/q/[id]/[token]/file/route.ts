import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { recordQuoteDownload } from "@/lib/quotes/tracking";

export const dynamic = "force-dynamic";

// Stream the uploaded quote file for an 'upload' quote — gated by the quote's
// accept token (the same token that lets the guest view/accept it, no login).
// The file lives in the PRIVATE quote-uploads bucket; we mint a short-lived
// signed URL server-side and redirect to it (never expose a public URL).
export async function GET(
  _req: Request,
  { params }: { params: { id: string; token: string } },
) {
  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("accept_token, attachment_path, attachment_name")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote || quote.accept_token !== params.token || !quote.attachment_path) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("quote-uploads")
    .createSignedUrl(quote.attachment_path, 300, {
      download: quote.attachment_name ?? true,
    });
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not open the file", { status: 500 });
  }
  await recordQuoteDownload(admin, params.id, headers().get("user-agent"));
  return NextResponse.redirect(signed.signedUrl);
}
