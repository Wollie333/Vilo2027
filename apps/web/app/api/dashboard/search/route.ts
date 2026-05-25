import { NextResponse } from "next/server";

import { createServerClient } from "@/lib/supabase/server";
import { searchEntities } from "@/lib/search/entitySearch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHENTICATED", message: "" } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const result = await searchEntities(q);

  return NextResponse.json({ success: true, data: result });
}
