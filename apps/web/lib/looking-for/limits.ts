// Free posting, but capped at this many ACTIVE Looking For requests per guest at
// a time. Authoritatively enforced by the DB trigger trg_looking_for_post_cap
// (migration 20260719140000); the create action mirrors it for a friendly
// message, and the marketing page quotes it. One source of truth.
export const MAX_ACTIVE_LOOKING_FOR_POSTS = 3;
