// Self-contained row types for the help-centre tables. Mirrors the SQL in
// supabase/migrations/20260525000010_help_center.sql. Kept hand-written here
// (rather than imported from @vilo/types) to match the convention used by the
// rest of apps/web — none of the existing query code imports the generated
// Database type.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type HelpAudience = "host" | "guest" | "both";
export type HelpStatus = "draft" | "published" | "archived";
export type HelpStatusComponentStatus =
  | "normal"
  | "degraded"
  | "incident"
  | "maintenance";
export type HelpVideoProvider = "youtube" | "vimeo";

export type HelpCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  audience: HelpAudience;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HelpArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_html: string;
  body_json: Json;
  category_id: string | null;
  audience: HelpAudience;
  status: HelpStatus;
  featured_rank: number | null;
  read_time_minutes: number;
  view_count: number;
  helpful_count: number;
  not_helpful_count: number;
  saved_count: number;
  has_video: boolean;
  published_at: string | null;
  author_id: string | null;
  last_editor_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HelpArticleListItem = Pick<
  HelpArticleRow,
  | "id"
  | "slug"
  | "title"
  | "excerpt"
  | "category_id"
  | "audience"
  | "status"
  | "featured_rank"
  | "read_time_minutes"
  | "helpful_count"
  | "not_helpful_count"
  | "view_count"
  | "has_video"
  | "published_at"
  | "updated_at"
>;

export type HelpVideoRow = {
  id: string;
  title: string;
  description: string;
  category_id: string | null;
  audience: HelpAudience;
  embed_provider: HelpVideoProvider;
  embed_id: string;
  embed_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  status: HelpStatus;
  featured_rank: number | null;
  sort_order: number;
  is_new: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HelpFaqRow = {
  id: string;
  question: string;
  answer_html: string;
  category_id: string | null;
  audience: HelpAudience;
  is_featured: boolean;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type HelpStatusRow = {
  id: string;
  name: string;
  icon: string;
  uptime_pct: number;
  status: HelpStatusComponentStatus;
  note: string | null;
  spark_values: Json;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type HelpSettingsRow = {
  key: string;
  value: Json;
  updated_at: string;
};

export type HelpSuggestionRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  message: string;
  status: "open" | "planned" | "shipped" | "dismissed";
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

export type HelpCategoryWithCount = HelpCategoryRow & {
  article_count: number;
};

export type HelpContactSettings = {
  live_chat_online: boolean;
  callback_enabled: boolean;
  support_email: string;
  median_response_minutes: number;
  community_member_count: number;
};

export type HelpCommunityThread = {
  title: string;
  author: string;
  replies: number;
  ago: string;
  initials: string;
  accent: "primary" | "secondary" | "mute";
};

export const HELP_CONTACT_DEFAULTS: HelpContactSettings = {
  live_chat_online: false,
  callback_enabled: false,
  support_email: "hello@viloplatform.com",
  median_response_minutes: 4,
  community_member_count: 0,
};

export function parseTrendingPills(raw: Json | undefined | null): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

export function parseContactSettings(
  raw: Json | undefined | null,
): HelpContactSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return HELP_CONTACT_DEFAULTS;
  }
  const r = raw as Record<string, Json>;
  return {
    live_chat_online: Boolean(r.live_chat_online ?? false),
    callback_enabled: Boolean(r.callback_enabled ?? false),
    support_email:
      typeof r.support_email === "string"
        ? r.support_email
        : HELP_CONTACT_DEFAULTS.support_email,
    median_response_minutes:
      typeof r.median_response_minutes === "number"
        ? r.median_response_minutes
        : HELP_CONTACT_DEFAULTS.median_response_minutes,
    community_member_count:
      typeof r.community_member_count === "number"
        ? r.community_member_count
        : 0,
  };
}

export function parseCommunityThreads(
  raw: Json | undefined | null,
): HelpCommunityThread[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is Record<string, Json> => !!r && typeof r === "object")
    .map((r) => ({
      title: String(r.title ?? ""),
      author: String(r.author ?? ""),
      replies: Number(r.replies ?? 0),
      ago: String(r.ago ?? ""),
      initials: String(r.initials ?? "??")
        .slice(0, 2)
        .toUpperCase(),
      accent: (r.accent === "primary" || r.accent === "mute"
        ? r.accent
        : "secondary") as HelpCommunityThread["accent"],
    }))
    .filter((t) => t.title);
}

export function parseSparkValues(raw: Json | undefined | null): number[] {
  const fallback = [80, 90, 85, 95, 90, 100, 95];
  if (!Array.isArray(raw)) return fallback;
  const nums = raw
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
  return nums.length > 0 ? nums : fallback;
}
