import { describe, expect, it, vi } from "vitest";

// postViews.ts is a server module (`import "server-only"`); stub that marker so
// the helper can be unit-tested in the node environment.
vi.mock("server-only", () => ({}));

import { recordPostView } from "./postViews";

const POST = "11111111-1111-1111-1111-111111111111";
const HOST = "22222222-2222-2222-2222-222222222222";
const HOST_USER = "33333333-3333-3333-3333-333333333333";
const GUEST_USER = "44444444-4444-4444-4444-444444444444";

function fakeClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from } as never, from, upsert };
}

describe("recordPostView", () => {
  it("records a distinct host view", async () => {
    const { client, from, upsert } = fakeClient();

    await recordPostView(client, {
      postId: POST,
      hostId: HOST,
      guestUserId: GUEST_USER,
      viewerUserId: HOST_USER,
    });

    expect(from).toHaveBeenCalledWith("looking_for_post_views");
    expect(upsert).toHaveBeenCalledWith(
      { post_id: POST, host_id: HOST },
      { onConflict: "post_id,host_id", ignoreDuplicates: true },
    );
  });

  // The upsert IS the idempotency: view_count is COUNT(*) over these rows, so
  // conflicting on (post_id, host_id) is what makes the number mean "distinct
  // hosts". Drop either option and a reload starts inflating the guest's stats.
  it("is idempotent when the same host views twice", async () => {
    const { client, upsert } = fakeClient();

    const view = {
      postId: POST,
      hostId: HOST,
      guestUserId: GUEST_USER,
      viewerUserId: HOST_USER,
    };
    await recordPostView(client, view);
    await recordPostView(client, view);

    expect(upsert).toHaveBeenCalledTimes(2);
    for (const call of upsert.mock.calls) {
      expect(call[1]).toEqual({
        onConflict: "post_id,host_id",
        ignoreDuplicates: true,
      });
    }
  });

  // A host is also a guest and can open their own request by URL. `unlockLead`
  // refuses that case; the counter has to agree, or "seen by 1 host" means
  // "seen by nobody but me".
  it("does not count a host viewing their own request", async () => {
    const { client, upsert } = fakeClient();

    await recordPostView(client, {
      postId: POST,
      hostId: HOST,
      guestUserId: HOST_USER,
      viewerUserId: HOST_USER,
    });

    expect(upsert).not.toHaveBeenCalled();
  });

  it("still records when the post owner is unknown", async () => {
    const { client, upsert } = fakeClient();

    await recordPostView(client, {
      postId: POST,
      hostId: HOST,
      guestUserId: null,
      viewerUserId: HOST_USER,
    });

    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
