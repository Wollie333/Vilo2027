import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import { parseVideoEmbed } from "./embed";

// Admin-managed welcome VIDEO for the host onboarding overview. Stored as a
// single help_settings KV row (no migration) so an admin can set/clear it from
// the Communications section. The overview hero renders the embed when a valid
// URL is set, else it falls back to the setup progress ring.
export const ONBOARDING_VIDEO_KEY = "onboarding_welcome_video";

export type OnboardingWelcomeVideo = {
  /** The raw URL the admin pasted (YouTube / Vimeo). */
  url: string;
  /** Ready-to-iframe embed URL derived from the raw URL. */
  embedUrl: string;
  provider: "youtube" | "vimeo";
};

/**
 * The current welcome video for the onboarding overview, or null when unset /
 * invalid. Reuses the same {@link parseVideoEmbed} the help videos use, so a
 * bad/blank URL simply falls back to the progress ring (never a broken iframe).
 */
export async function fetchOnboardingWelcomeVideo(): Promise<OnboardingWelcomeVideo | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("help_settings")
    .select("value")
    .eq("key", ONBOARDING_VIDEO_KEY)
    .maybeSingle();

  const url = (data?.value as { url?: string } | null)?.url?.trim();
  if (!url) return null;
  const parsed = parseVideoEmbed(url);
  if (!parsed) return null;
  return { url, embedUrl: parsed.embedUrl, provider: parsed.provider };
}
