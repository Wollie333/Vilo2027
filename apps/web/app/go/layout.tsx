import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import "../globals.css";

// Root layout for the locale-free /go funnel branch. The app has no top-level
// app/layout.tsx — html/body + globals.css live in app/[locale]/layout.tsx, which
// does NOT cover /go, so Next auto-generated a bare (unstyled) layout here. This
// replaces it: it provides html/body, the brand fonts, and the global stylesheet,
// and nothing else. The funnel pages are standalone and English-only (frontend
// ZAR+English lock), so they deliberately skip the intl/brand/currency providers.

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

export default function GoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
