// Base URL for every link and button in an email.
//
// Deliberately duplicated from apps/web/lib/contact.ts rather than imported:
// this directory sits outside the web app's tsconfig `include` and is rendered
// from several runtimes (the web app, the email worker, the admin previewer),
// so it stays dependency-free. Keep the fallback in step with SITE_URL there.
//
// It used to fall back to `wieloplatform.com` — a domain we do not own — in 25
// templates, so with NEXT_PUBLIC_APP_URL unset every button in every email
// pointed at nothing.
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  "https://wielo.co.za"
).replace(/\/+$/, "");
