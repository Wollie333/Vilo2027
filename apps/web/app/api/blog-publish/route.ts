import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 50;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Shares EMAIL_WORKER_SECRET with the other queue workers.
function authorised(req: Request): boolean {
  const expected = process.env.EMAIL_WORKER_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  return timingSafeEqual(header.slice(prefix.length), expected);
}

/**
 * Publishes scheduled blog posts whose publish_at has passed. Pinged by the
 * publish-scheduled-posts pg_cron every 5 minutes. Blog posts render LIVE (not
 * from the publish snapshot), so flipping status='published' makes them appear
 * immediately — no website re-publish needed.
 */
export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Find scheduled posts whose publish_at has passed
    const { data: posts, error: selectError } = await admin
      .from("website_blog_posts")
      .select("id")
      .eq("status", "scheduled")
      .lte("publish_at", now)
      .is("deleted_at", null)
      .limit(BATCH_SIZE);

    if (selectError) throw new Error(selectError.message);

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        success: true,
        data: { published: 0 },
      });
    }

    const ids = posts.map((p) => p.id);

    // Update to published
    const { error: updateError } = await admin
      .from("website_blog_posts")
      .update({ status: "published" })
      .in("id", ids);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      success: true,
      data: { published: ids.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        success: false,
        error: { code: "BLOG_PUBLISH_FAILED", message },
      },
      { status: 500 },
    );
  }
}
