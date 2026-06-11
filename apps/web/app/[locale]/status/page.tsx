import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";

import { VLogo } from "@/app/_components/home/VLogo";
import { getBrandName } from "@/lib/brand";

async function checkSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return {
      ok: false,
      message: "Missing NEXT_PUBLIC_SUPABASE_URL or _ANON_KEY",
    };
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
    const body = (await res.json()) as { name?: string; version?: string };
    return {
      ok: true,
      message: `OK — ${body.name ?? "auth"} ${body.version ?? ""}`.trim(),
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Network error",
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandName();
  return {
    title: "Status",
    description: `Live readout of the ${brandName} platform stack.`,
  };
}

export default async function StatusPage() {
  const brandName = await getBrandName();
  const conn = await checkSupabaseConnection();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing)";

  return (
    <main className="min-h-screen bg-brand-light text-brand-ink">
      <section className="relative overflow-hidden border-b border-brand-line bg-white">
        <div aria-hidden className="absolute inset-0 bg-dot-grid opacity-70" />
        <div className="relative mx-auto max-w-5xl px-6 py-16 sm:py-20 lg:px-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <VLogo size={40} gradientId="status-logo" />
            <span className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-brand-mute">
              {brandName} · Status
            </span>
          </Link>

          <h1 className="mt-8 max-w-3xl font-display text-3xl font-bold leading-[1.1] tracking-tight text-brand-ink sm:text-4xl">
            Foundation status
          </h1>
          <p className="mt-3 max-w-2xl text-base text-brand-mute">
            Live readout of the bootstrapped stack. This page is for the build
            team — not the public.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16 lg:px-10">
        <div className="rounded-card border border-brand-line bg-white p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-brand-ink">
                Supabase
              </h2>
              <p className="mt-1 text-sm text-brand-mute">
                Auth health endpoint check, server-side.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-medium ${
                conn.ok
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-pill ${
                  conn.ok ? "bg-green-600" : "bg-red-600"
                }`}
              />
              {conn.ok ? "Connected" : "Error"}
            </span>
          </div>

          <dl className="mt-6 divide-y divide-brand-line text-sm">
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-brand-mute">Next.js</dt>
              <dd className="text-right">14.2 — App Router, TS strict</dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-brand-mute">Tailwind</dt>
              <dd className="text-right">
                3.4 — Vilo Design System tokens loaded
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-brand-mute">Supabase project</dt>
              <dd className="break-all text-right font-mono text-xs text-brand-ink">
                {supabaseUrl}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-brand-mute">Connection</dt>
              <dd
                className={`text-right text-sm font-medium ${
                  conn.ok ? "text-status-confirmed" : "text-status-cancelled"
                }`}
              >
                {conn.ok ? conn.message : `Error: ${conn.message}`}
              </dd>
            </div>
          </dl>
        </div>

        <footer className="mt-10 text-xs text-brand-mute">
          See{" "}
          <code className="rounded-sm bg-brand-accent px-1.5 py-0.5 font-mono text-[11px] text-brand-primary">
            PHASE_PLAN.md
          </code>{" "}
          for the live build order ·{" "}
          <Link
            href="/DESIGN_SYSTEM.HTML"
            className="text-brand-primary hover:underline"
          >
            Design system
          </Link>
        </footer>
      </section>
    </main>
  );
}
