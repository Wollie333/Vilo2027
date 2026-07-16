import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Stream the host brochure attached to a quote — gated by the quote's accept
// token (the same token that lets the guest view/accept it, no login). The
// brochure lives in the PRIVATE host-brochures bucket; we mint a short-lived
// signed URL server-side and redirect to it (never expose a public URL).
export async function GET(
  _req: Request,
  { params }: { params: { id: string; token: string } },
) {
  const admin = createAdminClient();
  const { data: quote } = await admin
    .from("quotes")
    .select("accept_token, brochure_path, brochure_name")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!quote || quote.accept_token !== params.token || !quote.brochure_path) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("host-brochures")
    .createSignedUrl(quote.brochure_path, 300, {
      download: quote.brochure_name ?? true,
    });
  if (error || !signed?.signedUrl) {
    return new NextResponse("Could not open the brochure", { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
