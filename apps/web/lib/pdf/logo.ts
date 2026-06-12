import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fetch a host's logo as a base64 data URI for embedding in a generated PDF.
 * A data URI (vs a remote URL) avoids any render-time network/CORS issues in
 * @react-pdf. Returns null on no-logo / any failure, so the document falls back
 * to its lettered brand mark.
 */
export async function hostLogoDataUri(
  hostId: string | null | undefined,
  // The business whose logo to embed (resolve from the document's listing).
  // Omit to use the host's default business logo.
  businessId?: string | null,
): Promise<string | null> {
  if (!hostId && !businessId) return null;
  try {
    const admin = createAdminClient();
    let logoPath: string | null = null;
    if (businessId) {
      const { data } = await admin
        .from("businesses")
        .select("logo_path")
        .eq("id", businessId)
        .maybeSingle();
      logoPath = data?.logo_path ?? null;
    } else if (hostId) {
      const { data } = await admin
        .from("businesses")
        .select("logo_path")
        .eq("host_id", hostId)
        .eq("is_default", true)
        .eq("is_archived", false)
        .maybeSingle();
      logoPath = data?.logo_path ?? null;
    }
    if (!logoPath) return null;

    const { data: pub } = admin.storage
      .from("host-logos")
      .getPublicUrl(logoPath);
    const res = await fetch(pub.publicUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
