import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function ImpersonatedDashboardPage({
  params,
}: {
  params: { userId: string };
}) {
  const service = createAdminClient();

  const [{ data: profile }, { data: host }] = await Promise.all([
    service
      .from("user_profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .eq("id", params.userId)
      .maybeSingle(),
    service
      .from("hosts")
      .select(
        "id, display_name, handle, is_verified, total_bookings, avg_rating",
      )
      .eq("user_id", params.userId)
      .maybeSingle(),
  ]);

  let listingCount = 0;
  let bookingCount = 0;
  if (host) {
    const [listingsRes, bookingsRes] = await Promise.all([
      service
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id)
        .is("deleted_at", null),
      service
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("host_id", host.id),
    ]);
    listingCount = listingsRes.count ?? 0;
    bookingCount = bookingsRes.count ?? 0;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold text-brand-ink">
          {profile?.full_name ?? profile?.email ?? "Unknown user"}
        </h1>
        <p className="mt-1 text-[13px] text-brand-mute">
          Read-only view of this user&apos;s dashboard. To edit anything, use
          the direct admin URLs — every write is audit-logged.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <Tile label="Email" value={profile?.email ?? "—"} />
        <Tile label="Role" value={profile?.role ?? "—"} />
        <Tile
          label="Status"
          value={profile?.is_active ? "Active" : "Suspended"}
        />
        {host ? (
          <>
            <Tile label="Host handle" value={`@${host.handle}`} />
            <Tile
              label="Verification"
              value={host.is_verified ? "Verified" : "Unverified"}
            />
            <Tile label="Listings" value={listingCount.toLocaleString()} />
            <Tile
              label="Total bookings"
              value={bookingCount.toLocaleString()}
            />
            <Tile
              label="Avg rating"
              value={host.avg_rating?.toFixed?.(2) ?? "—"}
            />
          </>
        ) : null}
      </section>

      {!host ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-5 text-[13px] text-brand-mute">
          This user is not a host. Phase B will add guest-side read views
          (bookings, messages, refunds).
        </div>
      ) : null}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1.5 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}
