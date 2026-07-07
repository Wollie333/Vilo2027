// Single source of truth for the legal-consent version captured at signup.
// Bump this whenever the Terms of Service / Privacy Policy change materially —
// `user_profiles.terms_version` then records which version each user accepted,
// and you can prompt existing users to re-accept by comparing against this.
export const TERMS_VERSION = "2026-07-01";
