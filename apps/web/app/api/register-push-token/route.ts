import { NextResponse } from "next/server";

import { isExpoPushToken } from "@/lib/notifications/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mobile entrypoint per NOTIFICATIONS.md §5.
// POST: register a push token for the authenticated user's current device.
// DELETE: deactivate a token (called on logout). If body omits the token,
// all of the user's active tokens are deactivated.

type PostBody = {
  token: string;
  platform: "ios" | "android";
  device_name?: string;
};

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "invalid json" },
      },
      { status: 400 },
    );
  }

  if (!body.token || !isExpoPushToken(body.token)) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "invalid expo push token" },
      },
      { status: 400 },
    );
  }
  if (body.platform !== "ios" && body.platform !== "android") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "BAD_REQUEST", message: "platform must be ios|android" },
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("push_tokens").upsert(
    {
      user_id: user.id,
      token: body.token,
      platform: body.platform,
      device_name: body.device_name ?? null,
      is_active: true,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "TOKEN_REGISTER_FAILED", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { registered: true } });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "" } },
      { status: 401 },
    );
  }

  let token: string | undefined;
  try {
    const body = (await req.json()) as { token?: string };
    token = body.token;
  } catch {
    token = undefined;
  }

  const admin = createAdminClient();
  let q = admin
    .from("push_tokens")
    .update({ is_active: false })
    .eq("user_id", user.id);
  if (token) q = q.eq("token", token);
  const { error } = await q;

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "TOKEN_DEREGISTER_FAILED", message: error.message },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, data: { deactivated: true } });
}

async function currentUser() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
