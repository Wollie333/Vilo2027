import {
  ArrowLeft,
  BedDouble,
  Bath,
  Users as UsersIcon,
  CalendarCheck,
  Images,
  ShieldCheck,
  Star,
  ExternalLink,
  MapPin,
} from "lucide-react";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { requirePermission } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminStatBand } from "../../_components/AdminStatBand";
import { ListingActions } from "../ListingActions";

export const dynamic = "force-dynamic";

function rand(n: number | null | undefined, currency = "ZAR"): string {
  if (n == null) return "—";
  const sym = currency === "ZAR" ? "R" : `${currency} `;
  return `${sym} ${Math.round(Number(n))
    .toLocaleString("en-ZA")
    .replace(/,/g, " ")}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type HostRel = {
  id: string;
  handle: string | null;
  display_name: string | null;
  is_verified: boolean | null;
};

export default async function AdminListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("listings.edit");
  const service = createAdminClient();

  const { data: p } = await service
    .from("properties")
    .select(
      `
      id, name, slug, property_type, accommodation_type, description, house_rules,
      address_line1, address_line2, city, province, country, postal_code,
      bedrooms, bathrooms, max_guests, check_in_time, check_out_time,
      min_nights, max_nights, base_price, weekend_price, cleaning_fee, currency,
      cancellation_policy, cancellation_policy_label, instant_booking,
      accepts_paystack, accepts_paypal, accepts_eft,
      is_published, is_featured, is_suspended, published_at,
      total_bookings, total_reviews, avg_rating, created_at, deleted_at,
      host:hosts ( id, handle, display_name, is_verified )
    `,
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!p) notFound();

  const host = (Array.isArray(p.host) ? p.host[0] : p.host) as HostRel | null;

  // Content counts — same enrichment the listings table uses.
  const [{ count: rooms }, { count: photos }, { count: bookings }] =
    await Promise.all([
      service
        .from("property_rooms")
        .select("id", { count: "exact", head: true })
        .eq("property_id", p.id),
      service
        .from("property_photos")
        .select("id", { count: "exact", head: true })
        .eq("property_id", p.id),
      service
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("property_id", p.id),
    ]);

  const location = [p.address_line1, p.city, p.province, p.postal_code]
    .filter(Boolean)
    .join(", ");

  const payments = [
    p.accepts_paystack ? "Paystack" : null,
    p.accepts_paypal ? "PayPal" : null,
    p.accepts_eft ? "EFT" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/properties"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute hover:text-brand-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All listings
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-brand-ink">
              {p.name}
            </h1>
            {p.is_published ? (
              <Pill tone="good">Published</Pill>
            ) : (
              <Pill tone="pending">Draft</Pill>
            )}
            {p.is_featured ? <Pill tone="primary">Featured</Pill> : null}
            {p.is_suspended ? <Pill tone="danger">Suspended</Pill> : null}
            {p.deleted_at ? <Pill tone="danger">Deleted</Pill> : null}
          </div>
          <p className="mt-1 text-[12px] uppercase tracking-wider text-brand-mute">
            {p.property_type}
            {p.accommodation_type ? ` · ${p.accommodation_type}` : ""}
            {location ? (
              <>
                {" · "}
                <MapPin className="inline h-3.5 w-3.5" /> {location}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {p.slug ? (
            <a
              href={`/property/${p.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line bg-white px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-light"
            >
              <ExternalLink className="h-4 w-4" /> Public page
            </a>
          ) : null}
          <ListingActions
            listingId={p.id}
            slug={p.slug}
            isPublished={p.is_published}
            isFeatured={p.is_featured}
            name={p.name}
          />
        </div>
      </header>

      <AdminStatBand
        cols={4}
        stats={[
          { label: "Bookings", value: p.total_bookings ?? bookings ?? 0 },
          { label: "Rooms", value: rooms ?? 0 },
          {
            label: "Photos",
            value: photos ?? 0,
            tone: (photos ?? 0) === 0 ? "amber" : "default",
          },
          {
            label: "Rating",
            value:
              (p.total_reviews ?? 0) > 0
                ? `${Number(p.avg_rating ?? 0).toFixed(1)} (${p.total_reviews})`
                : "—",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Host">
          {host ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/hosts/${host.id}`}
                className="text-[14px] font-semibold text-brand-primary hover:underline"
              >
                {host.display_name ?? host.handle ?? "Unnamed host"}
              </Link>
              {host.is_verified ? (
                <ShieldCheck
                  className="h-4 w-4 text-brand-primary"
                  aria-label="Verified host"
                />
              ) : null}
            </div>
          ) : (
            <span className="text-brand-mute">No host on record</span>
          )}
          {host?.handle ? (
            <div className="mt-1 font-mono text-[12px] text-brand-mute">
              @{host.handle}
            </div>
          ) : null}
        </Panel>

        <Panel title="Pricing">
          <Row label="Base price" value={rand(p.base_price, p.currency)} />
          <Row
            label="Weekend price"
            value={rand(p.weekend_price, p.currency)}
          />
          <Row label="Cleaning fee" value={rand(p.cleaning_fee, p.currency)} />
          <Row
            label="Cancellation"
            value={p.cancellation_policy_label ?? p.cancellation_policy ?? "—"}
          />
          <Row
            label="Instant booking"
            value={p.instant_booking ? "On" : "Off"}
          />
          <Row
            label="Payment methods"
            value={payments.length ? payments.join(", ") : "None set"}
          />
        </Panel>

        <Panel title="Capacity & stay">
          <div className="flex flex-wrap gap-4 text-[13px] text-brand-ink">
            <span className="inline-flex items-center gap-1.5">
              <BedDouble className="h-4 w-4 text-brand-mute" />{" "}
              {p.bedrooms ?? "—"} bed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Bath className="h-4 w-4 text-brand-mute" /> {p.bathrooms ?? "—"}{" "}
              bath
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon className="h-4 w-4 text-brand-mute" />{" "}
              {p.max_guests ?? "—"} guests
            </span>
          </div>
          <Row
            label="Nights"
            value={`min ${p.min_nights ?? 1}${p.max_nights ? ` · max ${p.max_nights}` : ""}`}
          />
          <Row
            label="Check-in / out"
            value={`${p.check_in_time ?? "—"} / ${p.check_out_time ?? "—"}`}
          />
        </Panel>

        <Panel title="Record">
          <Row
            label="Listing id"
            value={<span className="font-mono text-[11px]">{p.id}</span>}
          />
          <Row label="Created" value={fmtDate(p.created_at)} />
          <Row label="Published at" value={fmtDate(p.published_at)} />
          <Row
            label="Content"
            value={
              <span className="inline-flex items-center gap-3 text-brand-mute">
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" /> {rooms ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Images className="h-3.5 w-3.5" /> {photos ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarCheck className="h-3.5 w-3.5" /> {bookings ?? 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" /> {p.total_reviews ?? 0}
                </span>
              </span>
            }
          />
        </Panel>
      </div>

      {p.description ? (
        <Panel title="Description">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink">
            {p.description}
          </p>
        </Panel>
      ) : null}

      {p.house_rules ? (
        <Panel title="House rules">
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-brand-ink">
            {p.house_rules}
          </p>
        </Panel>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-4">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-mute">
        {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13px]">
      <span className="shrink-0 text-brand-mute">{label}</span>
      <span className="min-w-0 text-right font-medium text-brand-ink">
        {value}
      </span>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "good" | "pending" | "primary" | "danger";
}) {
  const cls =
    tone === "good"
      ? "bg-status-confirmed/10 text-status-confirmed"
      : tone === "primary"
        ? "bg-brand-primary/10 text-brand-primary"
        : tone === "danger"
          ? "bg-status-cancelled/10 text-status-cancelled"
          : "bg-status-pending/10 text-status-pending";
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
