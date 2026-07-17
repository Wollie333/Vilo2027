import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import NextTopLoader from "nextjs-toploader";

import { PlatformMarketing } from "@/components/analytics/PlatformMarketing";
import { BrandProvider } from "@/components/brand/BrandProvider";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { BusyHost } from "@/components/ui/busy-host";
import { ModalHost } from "@/components/ui/modal-host";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { getBranding, getBrandName } from "@/lib/brand";
import { getDisplayRates } from "@/lib/fx";
import { getPlatformTracking } from "@/lib/integrations/meta";

import { CookieBanner } from "../_components/CookieBanner";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// Pre-render a static variant per locale (en, af, fr, de, pt).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Explicit mobile-first viewport (previously relying on Next's implicit default).
// Makes the width/initial-scale contract explicit and future-proof; does not set
// viewport-fit=cover, so safe-area insets stay reserved by the OS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Dynamic so the configurable brand name drives the document title. Child pages
// set a bare `title` (e.g. "Inbox") and the template appends " · {brand}", so
// every browser-tab title follows the brand name from one place.
export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrandName();
  return {
    title: { default: brand, template: `%s · ${brand}` },
    description: "Direct-booking management for accommodation hosts.",
  };
}

export default async function RootLayout({
  children,
  params: { locale },
}: Readonly<{ children: React.ReactNode; params: { locale: string } }>) {
  // Reject unknown locales (e.g. /zz/...) before rendering.
  if (!(routing.locales as readonly string[]).includes(locale)) notFound();
  // Enable static rendering for this request's locale.
  setRequestLocale(locale);

  const [branding, rates, messages, platformTracking] = await Promise.all([
    getBranding(),
    getDisplayRates(),
    getMessages(),
    getPlatformTracking(),
  ]);
  const hasPlatformTracking = Object.values(platformTracking).some(Boolean);
  const displayCurrency = cookies().get("vilo_display_ccy")?.value ?? null;
  // On a host's own micro-site (tenant domain), the host's OWN pixel is loaded
  // by SiteMarketing. Do NOT also load the Wielo platform pixel there, or a
  // host-website booking would cross-fire onto Wielo's pixel. The Wielo pixel is
  // for the marketplace/app surfaces only (directory listing bookings etc.).
  const isHostSite = !!headers().get("x-wielo-site-host");
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        {/* Instant top-bar feedback on EVERY navigation (link click, router
            push, back/forward) so a click never feels dead while the next
            route loads. Brand green on the Wielo app; on a host's themed site
            it adopts the theme accent (SiteThemeRoot sets --wielo-toploader on
            :root). Spinner off — the bar alone reads clean.
            See RULES.md → "Every action gives feedback". */}
        <NextTopLoader
          color="var(--wielo-toploader, #10B981)"
          height={3}
          shadow="0 0 8px var(--wielo-toploader, #10B981),0 0 4px var(--wielo-toploader, #10B981)"
          showSpinner={false}
          crawlSpeed={180}
          speed={220}
        />
        {hasPlatformTracking && !isHostSite ? (
          <PlatformMarketing tracking={platformTracking} />
        ) : null}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <BrandProvider value={branding}>
            <CurrencyProvider initialCurrency={displayCurrency} rates={rates}>
              {children}
              <CookieBanner />
              <Toaster richColors position="top-center" />
              <ModalHost />
              <BusyHost />
            </CurrencyProvider>
          </BrandProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
