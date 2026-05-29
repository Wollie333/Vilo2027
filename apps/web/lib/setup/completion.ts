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

  // rooms_only listings price/seat per room, so the whole-listing base_price /
  // max_guests aren't the signal there — a published room set is.
  const isRoomsOnly = listing?.booking_mode === "rooms_only";
  const listingCore = isRoomsOnly
    ? input.roomCount > 0
    : listing?.base_price != null && listing?.max_guests != null;
  const listingDone = Boolean(listing && input.photoCount > 0 && listingCore);

  // Experiences have no check-in / check-out times — only accommodation does.
  const isExperience = listing?.listing_type === "experience";
  const policies = Boolean(
    listing &&
    hasText(listing.cancellation_policy) &&
    (isExperience ||
      (hasText(listing.check_in_time) && hasText(listing.check_out_time))),
  );

  const review = Boolean(listing?.is_published);

  return { profile, banking, listing: listingDone, policies, review };
}
