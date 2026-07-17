import type { ThemeOption } from "@/lib/site/themes.server";
import type { ContentProfile } from "@/lib/website/contentProfile.schema";
import type { SiteAnswers } from "@/lib/website/aiPrompts";

/**
 * The six pages the wizard builds, in canonical order (spec-locked — no extra
 * Experiences/Gallery pages; hosts add extras manually in the builder later).
 * `blog` is surfaced to the host as "Journal".
 */
export type WizardPageKind =
  | "home"
  | "about"
  | "rooms"
  | "specials"
  | "blog"
  | "contact";

/** A page row in the Pages step: its kind + whether it's included in the nav. */
export type WizardPage = {
  kind: WizardPageKind;
  include: boolean;
};

/** Canonical page set + default order — every page included by default. */
export const WIZARD_DEFAULT_PAGES: readonly WizardPage[] = [
  { kind: "home", include: true },
  { kind: "about", include: true },
  { kind: "rooms", include: true },
  { kind: "specials", include: true },
  { kind: "blog", include: true },
  { kind: "contact", include: true },
] as const;

/** A room for the nav preview's auto-generated Rooms submenu. */
export type WizardRoom = {
  name: string;
  slug: string;
};

/** The three real supported payment methods (spec-locked — no PayFast/cash). */
export type WizardPaymentKey = "paystack" | "paypal" | "eft";

/**
 * A payment method as surfaced in the confirm-and-activate step. `status`:
 * "active" = configured & ready; "review" = missing required config. Labels +
 * descriptions are i18n in the component (the method set is fixed).
 */
export type WizardPaymentMethod = {
  key: WizardPaymentKey;
  status: "active" | "review";
  /** Deep link to the account editor for this method. */
  editHref: string;
};

/** A policy as surfaced in the confirm-and-activate step. */
export type WizardPolicy = {
  /** Stable key (policy id, or type when unconfigured). */
  key: string;
  type: string;
  name: string;
  /** One-line human summary (times, cancellation preset, …). */
  summary: string;
  /** False when the policy type isn't configured yet (amber "Add" row). */
  configured: boolean;
  /** Deep link to the account editor for this policy. */
  editHref: string;
};

/** Mutable state collected across the wizard steps before the one-shot create. */
export type WizardState = {
  siteName: string;
  subdomain: string;
  logoPath: string | null;
  contactEmail: string;
  contactPhone: string;
  /** Selected theme catalogue id (ThemeOption.id). */
  themeId: string;
  /** Index into generatePalettes() (0-4). */
  paletteIndex: number;
  /** True when the host chose the "Custom" accent card. */
  useCustom: boolean;
  /** Custom accent hex (used when useCustom). */
  customAccent: string;
  /** Ordered page set for the site nav (Pages step). */
  pages: WizardPage[];
  /** Per-method "show on website" toggles, keyed by WizardPaymentKey. */
  paymentVisibility: Record<string, boolean>;
  /** Per-policy "show on website" toggles, keyed by WizardPolicy.key. */
  policyVisibility: Record<string, boolean>;
  /** The host's raw answers for the AI content step (the "Your story" step). */
  answers: SiteAnswers;
  /** The generated content profile (null until generated / skipped). Passed into
   *  the build so seeding hydrates the theme pages with the host's copy. */
  contentProfile: ContentProfile | null;
};

/** The data the wizard needs to start (prefill + theme catalogue + account config). */
export type WizardProps = {
  businessId: string;
  defaultName: string;
  defaultSubdomain: string;
  logoPath: string | null;
  themes: ThemeOption[];
  /** The host's configured payment methods (confirm-and-activate step). */
  paymentMethods: WizardPaymentMethod[];
  /** The property's policies (confirm-and-activate step). */
  policies: WizardPolicy[];
  /** The host's rooms (Pages step nav preview → Rooms submenu). */
  rooms: WizardRoom[];
  /** A website that ALREADY exists for this business at page load (one-per-
   *  business). When set on mount, the wizard bounces to that site's editor.
   *  Null on a normal create — and the site the wizard itself creates does NOT
   *  set this, so the success screen is never auto-skipped. */
  existingWebsiteId?: string | null;
};

export function initialWizardState(p: WizardProps): WizardState {
  return {
    siteName: p.defaultName,
    subdomain: p.defaultSubdomain,
    logoPath: p.logoPath,
    contactEmail: "",
    contactPhone: "",
    themeId: p.themes[0]?.id ?? "",
    paletteIndex: 0,
    useCustom: false,
    customAccent: "",
    pages: WIZARD_DEFAULT_PAGES.map((p) => ({ ...p })),
    // Active methods show on the site by default; ones needing config start off.
    paymentVisibility: Object.fromEntries(
      p.paymentMethods.map((m) => [m.key, m.status === "active"]),
    ),
    // Configured policies show by default; unconfigured ones start off.
    policyVisibility: Object.fromEntries(
      p.policies.map((pol) => [pol.key, pol.configured]),
    ),
    answers: {},
    contentProfile: null,
  };
}

/** The accent of the selected theme's base palette (fallback green). */
export function themeBaseAccent(
  themes: ThemeOption[],
  themeId: string,
): string {
  const theme = themes.find((x) => x.id === themeId) ?? themes[0];
  return theme?.base?.palette?.accent ?? "#0a7d4b";
}
