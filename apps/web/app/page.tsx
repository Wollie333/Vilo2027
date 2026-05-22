async function checkSupabaseConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return { ok: false, message: "Missing NEXT_PUBLIC_SUPABASE_URL or _ANON_KEY" };
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

export default async function Home() {
  const conn = await checkSupabaseConnection();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(missing)";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <header className="mb-12">
          <h1 className="font-display text-3xl font-bold text-brand-primary sm:text-4xl">
            Vilo
          </h1>
          <p className="mt-2 text-muted-foreground">
            Direct-booking management for accommodation hosts and experience
            operators.
          </p>
        </header>

        <section className="rounded-card border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 font-display text-xl font-semibold">
            Foundation status
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Next.js</dt>
              <dd>14.2 — App Router, TypeScript strict</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tailwind</dt>
              <dd>3.4 — brand tokens loaded</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Supabase project</dt>
              <dd className="break-all font-mono text-xs">{supabaseUrl}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Connection</dt>
              <dd
                className={
                  conn.ok ? "text-status-confirmed" : "text-status-cancelled"
                }
              >
                {conn.ok ? conn.message : `Error: ${conn.message}`}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-12 text-xs text-muted-foreground">
          Phase 0 — Pre-build setup, slice 2. See{" "}
          <code className="rounded-sm bg-muted px-1 py-0.5">PHASE_PLAN.md</code>{" "}
          for what comes next.
        </footer>
      </div>
    </main>
  );
}
