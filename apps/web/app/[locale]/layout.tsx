import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { BrandProvider } from "@/components/brand/BrandProvider";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { ModalHost } from "@/components/ui/modal-host";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/i18n/routing";
import { getBranding, getBrandName } from "@/lib/brand";
import { getDisplayRates } from "@/lib/fx";

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

  const [branding, rates, messages] = await Promise.all([
    getBranding(),
    getDisplayRates(),
    getMessages(),
  ]);
  const displayCurrency = cookies().get("vilo_display_ccy")?.value ?? null;
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <BrandProvider value={branding}>
            <CurrencyProvider initialCurrency={displayCurrency} rates={rates}>
              {children}
              <CookieBanner />
              <Toaster richColors position="top-center" />
              <ModalHost />
            </CurrencyProvider>
          </BrandProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
