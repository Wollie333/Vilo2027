import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Fetch a host's logo as a base64 data URI for embedding in a generated PDF.
 * A data URI (vs a remote URL) avoids any render-time network/CORS issues in
 * @react-pdf. Returns null on no-logo / any failure, so the document falls back
 * to its lettered brand mark.
 */
export async function hostLogoDataUri(
  hostId: string | null | undefined,
): Promise<string | null> {
  if (!hostId) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("host_business_details")
      .select("logo_path")
      .eq("host_id", hostId)
      .maybeSingle();
    if (!data?.logo_path) return null;

    const { data: pub } = admin.storage
      .from("host-logos")
      .getPublicUrl(data.logo_path);
    const res = await fetch(pub.publicUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type") || "image/png";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
