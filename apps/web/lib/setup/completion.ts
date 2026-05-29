// Single source of truth for host onboarding completion.
//
// Both the setup wizard (client, from its in-memory props) and the dashboard
// "getting started" checklist (server, from fresh queries) must agree on what
// "done" means for each section — otherwise the wizard can mark a step complete
// while the dashboard still nags the host to finish it. This pure function is
// the shared predicate set; each caller gathers the inputs its own way and
// passes them in.

export type SetupSectionKey =
  | "profile"
  | "banking"
  | "listing"
  | "rooms"
  | "policies"
  | "review";

export type SetupCompletionInput = {
  host: {
    bio?: string | null;
    avatar_url?: string | null;
    languages_spoken?: string[] | null;
  } | null;
  /** A non-archived EFT bank account exists for the host. */
  hasBankAccount: boolean;
  listing: {
    listing_type?: string | null;
    booking_mode?: string | null;
    base_price?: number | string | null;
    max_guests?: number | null;
    cancellation_policy?: string | null;
    check_in_time?: string | null;
    check_out_time?: string | null;
    is_published?: boolean | null;
  } | null;
  /** Count of photos on the setup listing. */
  photoCount: number;
  /** Count of active rooms on the setup listing. */
  roomCount: number;
  /**
   * A refund (cancellation) policy is assigned to the setup listing
   * listing-wide (via listing_policies). Preferred over the legacy enum, which
   * is only synced for the locked presets — custom policies wouldn't set it.
   */
  hasCancellationPolicy?: boolean;
};

export type SetupCompletion = Record<SetupSectionKey, boolean>;

function hasText(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export function computeSetupCompletion(
  input: SetupCompletionInput,
): SetupCompletion {
  const { host, listing } = input;

  const profile = Boolean(
    hasText(host?.bio) &&
    hasText(host?.avatar_url) &&
    (host?.languages_spoken?.length ?? 0) > 0,
  );

  const banking = input.hasBankAccount;

  const isExperience = listing?.listing_type === "experience";

  // Listing details = photos (+ price/capacity for experiences, which have no
  // rooms). For accommodation, pricing & capacity live entirely in Rooms.
  const listingDone = Boolean(
    listing &&
    input.photoCount > 0 &&
    (!isExperience ||
      (listing.base_price != null && listing.max_guests != null)),
  );

  // Rooms is its own section for accommodation (≥1 active room drives price +
  // capacity); experiences have no rooms, so it's not applicable.
  const roomsDone = isExperience ? true : input.roomCount > 0;

  // Policies = a refund policy is set for the listing. With the Policy Manager,
  // refund terms are reusable policies assigned via listing_policies; the
  // legacy enum is only a fallback (synced for presets, not custom policies).
  const policies = Boolean(
    listing &&
    (input.hasCancellationPolicy === true ||
      hasText(listing.cancellation_policy)),
  );

  const review = Boolean(listing?.is_published);

  return {
    profile,
    banking,
    listing: listingDone,
    rooms: roomsDone,
    policies,
    review,
  };
}
