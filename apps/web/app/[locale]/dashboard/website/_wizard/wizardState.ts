import type { ThemeOption } from "@/lib/site/themes.server";

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
};

/** The data the wizard needs to start (prefill + theme catalogue). */
export type WizardProps = {
  businessId: string;
  defaultName: string;
  defaultSubdomain: string;
  logoPath: string | null;
  themes: ThemeOption[];
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
