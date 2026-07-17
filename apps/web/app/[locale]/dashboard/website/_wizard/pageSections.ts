// Canonical per-page section map for the wizard's expandable Pages step.
//
// Each page (by WizardPage kind) lists the SECTIONS ("elements") it carries — the
// system parts every booking site has. A section is either:
//   • content  — the host writes it (AI-assisted); bound to a content_profile slot
//   • listing  — auto-populated from the host's account data (rooms, gallery,
//                reviews, map, rates, forms); shown with a short note, not edited
// Content sections may carry an image slot with the ideal image size, and/or a
// repeating item list (experiences cards). Only the slots content_profile actually
// stores are editable here; host name/photo come from the account.

import type { AiStringSlot } from "@/lib/website/aiContent";
import type { ContentProfile } from "@/lib/website/contentProfile.schema";

export type TextField = {
  slot: TextSlot;
  label: string;
  placeholder?: string;
  multiline?: boolean;
};

export type ImageSlot = {
  /** Which content slot the uploaded path is written to. */
  slot: ImageSlotId;
  label: string;
  /** Human size hint shown under the drop zone, e.g. "1920 × 1080 px". */
  size: string;
  /** Aspect hint word: landscape / square / portrait. */
  shape: "landscape" | "square" | "portrait";
};

export type SectionSpec = {
  key: string;
  label: string;
  /** content = host-authored (AI-assist); listing = auto from account data. */
  kind: "content" | "listing";
  /** For listing sections — what it pulls in. */
  note?: string;
  /** Editable single-value text fields bound to content_profile. */
  fields?: TextField[];
  /** A single image slot for the section (hero, host photo …). */
  image?: ImageSlot;
  /** The experiences card list (title + body + per-card image). */
  items?: "experiences";
};

// Text slots that map 1:1 to a content_profile path.
export type TextSlot =
  | "home.hero.headline"
  | "home.hero.subheadline"
  | "home.intro.body"
  | "experiences.intro"
  | "about.story"
  | "about.hostBio.body";

export type ImageSlotId = "home.hero.image";

export const PAGE_SECTIONS: Record<string, SectionSpec[]> = {
  home: [
    {
      key: "hero",
      label: "Hero banner",
      kind: "content",
      fields: [
        {
          slot: "home.hero.headline",
          label: "Headline",
          placeholder: "Where the still water keeps the day",
        },
        {
          slot: "home.hero.subheadline",
          label: "Subheadline",
          placeholder: "A handful of rooms on the edge of the reserve.",
          multiline: true,
        },
      ],
      image: {
        slot: "home.hero.image",
        label: "Hero image",
        size: "1920 × 1080 px",
        shape: "landscape",
      },
    },
    {
      key: "intro",
      label: "Welcome",
      kind: "content",
      fields: [
        {
          slot: "home.intro.body",
          label: "Welcome text",
          placeholder: "A sentence or two welcoming your guests.",
          multiline: true,
        },
      ],
    },
    {
      key: "rooms",
      label: "Room cards",
      kind: "listing",
      note: "Your rooms, rates and photos pull in automatically from your listing.",
    },
    {
      key: "experiences",
      label: "Experiences",
      kind: "content",
      fields: [
        {
          slot: "experiences.intro",
          label: "Intro",
          placeholder: "What is there to do?",
          multiline: true,
        },
      ],
      items: "experiences",
    },
    {
      key: "gallery",
      label: "Gallery",
      kind: "listing",
      note: "Pulls your property photos.",
    },
    {
      key: "reviews",
      label: "Reviews",
      kind: "listing",
      note: "Pulls your published guest reviews.",
    },
    {
      key: "location",
      label: "Location & map",
      kind: "listing",
      note: "Pulls your address and shows a map.",
    },
    {
      key: "cta",
      label: "Booking call-to-action",
      kind: "listing",
      note: "Sends guests straight to your booking engine.",
    },
  ],
  about: [
    {
      key: "story",
      label: "Your story",
      kind: "content",
      fields: [
        {
          slot: "about.story",
          label: "Story",
          placeholder: "Why do you host? The land, the welcome, the why.",
          multiline: true,
        },
      ],
    },
    {
      key: "stats",
      label: "Stats band",
      kind: "listing",
      note: "Highlights drawn from your listing.",
    },
    {
      key: "hostBio",
      label: "Host bio",
      kind: "content",
      fields: [
        {
          slot: "about.hostBio.body",
          label: "About you",
          placeholder: "A short note from you to your guests.",
          multiline: true,
        },
      ],
      note: "Your name and photo come from your account profile.",
    },
    {
      key: "cta",
      label: "Booking call-to-action",
      kind: "listing",
      note: "Sends guests straight to your booking engine.",
    },
  ],
  rooms: [
    {
      key: "showcase",
      label: "Room showcases",
      kind: "listing",
      note: "Each room with its photos, price and details — from your listing.",
    },
    {
      key: "rates",
      label: "Rates table",
      kind: "listing",
      note: "Live nightly rates from your listing.",
    },
    {
      key: "cta",
      label: "Booking call-to-action",
      kind: "listing",
      note: "Sends guests straight to your booking engine.",
    },
  ],
  specials: [
    {
      key: "specials",
      label: "Specials & experiences",
      kind: "content",
      fields: [
        {
          slot: "experiences.intro",
          label: "Intro",
          placeholder: "Set the scene for your specials.",
          multiline: true,
        },
      ],
      items: "experiences",
    },
  ],
  blog: [
    {
      key: "posts",
      label: "Journal posts",
      kind: "listing",
      note: "Your published blog posts appear here.",
    },
  ],
  contact: [
    {
      key: "form",
      label: "Enquiry form",
      kind: "listing",
      note: "A working enquiry form wired to your inbox.",
    },
    {
      key: "map",
      label: "Map",
      kind: "listing",
      note: "Pulls your address and shows a map.",
    },
    {
      key: "faq",
      label: "Good to know (FAQ)",
      kind: "listing",
      note: "Pre-filled from your policies — fine-tune it in the builder.",
    },
  ],
};

// Which text slots the AI can write on their own ("✨ AI" per field). Slots with
// no mapping (e.g. the welcome text) are host-written only.
export function aiSlotFor(slot: TextSlot): AiStringSlot | null {
  switch (slot) {
    case "home.hero.headline":
      return "heroHeadline";
    case "home.hero.subheadline":
      return "heroSubheadline";
    case "about.story":
      return "aboutStory";
    case "about.hostBio.body":
      return "hostBioBody";
    case "experiences.intro":
      return "experiencesIntro";
    case "home.intro.body":
      return null;
  }
}

// ── content_profile slot get/set (immutable) ──────────────────
export function getTextSlot(p: ContentProfile, slot: TextSlot): string {
  switch (slot) {
    case "home.hero.headline":
      return p.home?.hero?.headline ?? "";
    case "home.hero.subheadline":
      return p.home?.hero?.subheadline ?? "";
    case "home.intro.body":
      return p.home?.intro?.body ?? "";
    case "experiences.intro":
      return p.experiences?.intro ?? "";
    case "about.story":
      return p.about?.story ?? "";
    case "about.hostBio.body":
      return p.about?.hostBio?.body ?? "";
  }
}

export function setTextSlot(
  p: ContentProfile,
  slot: TextSlot,
  value: string,
): ContentProfile {
  const v = value === "" ? undefined : value;
  switch (slot) {
    case "home.hero.headline":
      return {
        ...p,
        home: { ...p.home, hero: { ...p.home?.hero, headline: v } },
      };
    case "home.hero.subheadline":
      return {
        ...p,
        home: { ...p.home, hero: { ...p.home?.hero, subheadline: v } },
      };
    case "home.intro.body":
      return {
        ...p,
        home: { ...p.home, intro: { ...p.home?.intro, body: v } },
      };
    case "experiences.intro":
      return { ...p, experiences: { ...p.experiences, intro: v } };
    case "about.story":
      return { ...p, about: { ...p.about, story: v } };
    case "about.hostBio.body":
      return {
        ...p,
        about: { ...p.about, hostBio: { ...p.about?.hostBio, body: v } },
      };
  }
}

export function getImageSlot(
  p: ContentProfile,
  slot: ImageSlotId,
): string | undefined {
  switch (slot) {
    case "home.hero.image":
      return p.home?.hero?.imagePath;
  }
}

export function setImageSlot(
  p: ContentProfile,
  slot: ImageSlotId,
  path: string | undefined,
): ContentProfile {
  switch (slot) {
    case "home.hero.image":
      return {
        ...p,
        home: { ...p.home, hero: { ...p.home?.hero, imagePath: path } },
      };
  }
}

// Experiences cards (title + body + per-card image).
export type ExpItem = {
  title?: string;
  body?: string;
  icon?: string;
  imagePath?: string;
};

export function getExpItems(p: ContentProfile): ExpItem[] {
  return (p.experiences?.items ?? []) as ExpItem[];
}

export function setExpItems(
  p: ContentProfile,
  items: ExpItem[],
): ContentProfile {
  const cleaned = items
    .filter((i) => (i.title ?? "").trim().length > 0)
    .slice(0, 3)
    .map((i) => ({
      title: (i.title ?? "").trim(),
      body: i.body?.trim() || undefined,
      icon: i.icon,
      imagePath: i.imagePath,
    }));
  return {
    ...p,
    experiences: {
      ...p.experiences,
      items: cleaned.length ? cleaned : undefined,
    },
  };
}
