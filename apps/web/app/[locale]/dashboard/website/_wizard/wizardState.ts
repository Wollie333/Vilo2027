import type { ThemeOption } from "@/lib/site/themes.server";

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
