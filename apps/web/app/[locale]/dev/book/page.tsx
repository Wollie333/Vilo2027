import { PageDocRenderer } from "@/components/site/v2/PageDocRenderer";
import { SiteThemeRoot } from "@/components/site/SiteThemeRoot";
import { resolveThemeBase } from "@/lib/site/themes.server";
import type { PageDoc } from "@/lib/website/pageDoc.schema";
import "@/components/site/themes/theme-skins.css";

// DEV-ONLY (no auth): renders the booking_form + booking_confirmation elements
// through the REAL PageDocRenderer — the exact path the builder canvas uses — so
// their theme-skinned demo AND per-element `--el-*` styling can be VISUALLY
// VERIFIED locally (Principle #9). Left column = theme default; right column =
// with element overrides, proving the Style-tab engine reaches every sub-part.
// ?theme=<slug>.
export const dynamic = "force-dynamic";

const THEMES = ["oceansview", "safari", "sabela", "marmalade"] as const;

function widget(
  id: string,
  type: "booking_form" | "booking_confirmation" = "booking_form",
  elements?: Record<string, Record<string, unknown>>,
) {
  return {
    id: `sec-${id}`,
    type: "section" as const,
    kids: [
      {
        id: `col-${id}`,
        type: "column" as const,
        span: 12,
        kids: [
          { id: `w-${id}`, type, props: {}, ...(elements ? { elements } : {}) },
        ],
      },
    ],
  };
}

// A bold override on every declared sub-element, so a regression that stops a
// var reaching the demo is obvious on screen.
const FORM_STYLE = {
  card: { bg: "#fff7ed", radius: 24, borderColor: "#f59e0b", borderWidth: 2 },
  title: { color: "#b45309" },
  field: { borderColor: "#f59e0b", borderWidth: 2, radius: 4 },
  addon: { bg: "#ffedd5", radius: 2 },
  summary: { bg: "#fffbeb", radius: 2 },
  price: { color: "#b45309" },
  button: { bg: "#b45309", color: "#ffffff", radius: 999 },
};
const CONF_STYLE = {
  card: { bg: "#ecfeff", radius: 24, borderColor: "#06b6d4", borderWidth: 2 },
  title: { color: "#0e7490" },
  total: { color: "#0e7490" },
  bank: { bg: "#cffafe", radius: 2 },
};

export default async function DevBookPage({
  searchParams,
}: {
  searchParams?: { theme?: string };
}) {
  const themeSlug = THEMES.includes(
    (searchParams?.theme ?? "") as (typeof THEMES)[number],
  )
    ? (searchParams?.theme as string)
    : "oceansview";
  const base = await resolveThemeBase(themeSlug);

  const doc = {
    v: 2,
    meta: {},
    root: {
      id: "root",
      type: "root",
      kids: [
        widget("form-default"),
        widget("form-styled", "booking_form", FORM_STYLE),
        widget("conf-default", "booking_confirmation"),
        widget("conf-styled", "booking_confirmation", CONF_STYLE),
      ],
    },
  } as unknown as PageDoc;

  return (
    <SiteThemeRoot theme={{ base }}>
      <div style={{ background: "var(--site-bg)", minHeight: "100vh" }}>
        <PageDocRenderer doc={doc} />
      </div>
    </SiteThemeRoot>
  );
}
