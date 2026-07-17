import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";

import { requirePermission } from "@/lib/admin";
import { resolvePartyGuests } from "@/lib/bookings/party";
import { formatMoney } from "@/lib/format";
import { sumPaidFromRows } from "@/lib/payments/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Booking · Admin" };
export const dynamic = "force-dynamic";

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Read-only super-admin view of ANY booking — the one surface that isn't scoped
 * to a single host. The host's own /dashboard/bookings/[id] filters on
 * host_id = their own, so an admin opening a guest's booking from the user
 * record got a 404; the row was visible but dead.
 *
 * Gated on `users.view` — the same permission that already lists these bookings
 * on the user record this page is reached from, so it grants nothing new. There
 * is no `bookings.view` permission (only edit/cancel, which are writes).
 *
 * Read-only by construction: no actions, no mutations. Admin writes stay on the
 * existing audited surfaces.
 */
export default async function AdminBookingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePermission("users.view");
  const service = createAdminClient();

  const { data: booking } = await service
    .from("bookings")
    .select(
      "id, reference, status, payment_status, payment_method, scope, channel, origin, check_in, check_out, nights, guests_count, additional_guests, eft_proof_url, base_amount, cleaning_fee, discount_amount, vat_amount, total_amount, balance_due, currency, special_requests, host_message, cancellation_reason, created_at, confirmed_at, cancelled_at, guest_id, guest_name, guest_email, guest_phone, host_id, property_id, listing:properties ( id, name, slug, city, province ), host:hosts ( id, display_name, handle, user_id )",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (!booking) notFound();

  const listing = one(booking.listing) as {
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    province: string | null;
  } | null;
  const host = one(booking.host) as {
    id: string;
    display_name: string;
    handle: string;
    user_id: string | null;
  } | null;

  const [{ data: payments }, party] = await Promise.all([
    // kind / voided_at / refunded_amount are REQUIRED by sumPaidFromRows — it
    // sums Σ(amount − refunded_amount) over non-voided inbound rows. Omitting
    // refunded_amount silently over-counts a refunded payment as fully paid.
    service
      .from("payments")
      .select(
        "id, amount, currency, method, kind, status, voided_at, refunded_amount, provider_reference, captured_at, created_at",
      )
      .eq("booking_id", booking.id)
      .order("created_at", { ascending: true }),
    resolvePartyGuests(service, booking.additional_guests),
  ]);

  const amountPaid = sumPaidFromRows(payments ?? []);

  // eft-proofs is a private bucket and the column holds the object PATH.
  let proofUrl: string | null = null;
  if (booking.eft_proof_url) {
    const { data: signed } = await service.storage
      .from("eft-proofs")
      .createSignedUrl(booking.eft_proof_url, 3600);
    proofUrl = signed?.signedUrl ?? null;
  }

  const cur = booking.currency;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-[13px] text-brand-mute hover:text-brand-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Users
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-brand-ink">
            {listing?.name ?? "Booking"}
          </h1>
          <span className="rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 font-mono text-[12px] text-brand-mute">
            {booking.reference}
          </span>
          <Pill>{booking.status.replace(/_/g, " ")}</Pill>
          <Pill>{booking.payment_status.replace(/_/g, " ")}</Pill>
        </div>
        <p className="mt-1 text-[13px] text-brand-mute">
          Read-only. Every admin write stays on its own audited surface.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-4">
        <Tile
          label="Total"
          value={formatMoney(Number(booking.total_amount ?? 0), cur)}
        />
        <Tile label="Paid" value={formatMoney(amountPaid, cur)} />
        <Tile
          label="Balance"
          value={formatMoney(
            Math.max(0, Number(booking.total_amount ?? 0) - amountPaid),
            cur,
          )}
        />
        <Tile
          label="Stay"
          value={`${booking.nights ?? 0} night${booking.nights === 1 ? "" : "s"}`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Booking">
          <Row label="Reference" value={booking.reference} mono />
          <Row label="Check in" value={fmtDate(booking.check_in)} />
          <Row label="Check out" value={fmtDate(booking.check_out)} />
          <Row label="Guests" value={String(booking.guests_count ?? "—")} />
          <Row label="Scope" value={booking.scope ?? "—"} />
          <Row label="Channel" value={booking.channel ?? "—"} />
          <Row label="Method" value={booking.payment_method ?? "—"} />
          <Row label="Created" value={fmtDateTime(booking.created_at)} />
          <Row label="Confirmed" value={fmtDateTime(booking.confirmed_at)} />
          {booking.cancelled_at ? (
            <Row label="Cancelled" value={fmtDateTime(booking.cancelled_at)} />
          ) : null}
          {booking.cancellation_reason ? (
            <Row label="Reason" value={booking.cancellation_reason} />
          ) : null}
        </Card>

        <Card title="People">
          <Row
            label="Guest"
            value={booking.guest_name ?? "—"}
            href={booking.guest_id ? `/admin/users/${booking.guest_id}` : null}
          />
          <Row label="Guest email" value={booking.guest_email ?? "—"} />
          <Row label="Guest phone" value={booking.guest_phone ?? "—"} />
          <Row
            label="Host"
            value={host ? `${host.display_name} (@${host.handle})` : "—"}
            href={host?.user_id ? `/admin/users/${host.user_id}` : null}
          />
          <Row
            label="Property"
            value={
              listing
                ? [listing.name, listing.city].filter(Boolean).join(" · ")
                : "—"
            }
            href={listing?.slug ? `/property/${listing.slug}` : null}
          />
        </Card>

        <Card title="Money">
          <Row
            label="Base"
            value={formatMoney(Number(booking.base_amount ?? 0), cur)}
          />
          <Row
            label="Cleaning"
            value={formatMoney(Number(booking.cleaning_fee ?? 0), cur)}
          />
          {Number(booking.discount_amount ?? 0) > 0 ? (
            <Row
              label="Discount"
              value={`− ${formatMoney(Number(booking.discount_amount), cur)}`}
            />
          ) : null}
          {Number(booking.vat_amount ?? 0) > 0 ? (
            <Row
              label="VAT"
              value={formatMoney(Number(booking.vat_amount), cur)}
            />
          ) : null}
          <Row
            label="Total"
            value={formatMoney(Number(booking.total_amount ?? 0), cur)}
            strong
          />
          <Row label="Paid" value={formatMoney(amountPaid, cur)} />
        </Card>

        <Card
          title={`Who's coming (${1 + party.length} of ${booking.guests_count ?? 1})`}
        >
          <PersonRow
            name={booking.guest_name ?? booking.guest_email ?? "Lead guest"}
            sub={booking.guest_email}
            avatarUrl={null}
            lead
          />
          {party.map((g, i) => (
            <PersonRow
              key={i}
              name={g.name}
              sub={[g.email, g.phone].filter(Boolean).join(" · ") || null}
              avatarUrl={g.avatarUrl}
            />
          ))}
          {party.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-brand-mute">
              No additional party members.
            </p>
          ) : null}
        </Card>
      </div>

      {proofUrl ? (
        <Card title="Proof of payment">
          <div className="p-4">
            <p className="mb-3 text-[13px] text-brand-mute">
              The guest uploaded proof of an EFT transfer.
            </p>
            <a
              href={proofUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-brand-line bg-white px-4 py-3 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
            >
              <FileText className="h-4 w-4 text-brand-primary" /> View proof
              <ExternalLink className="h-3.5 w-3.5 text-brand-mute" />
            </a>
          </div>
        </Card>
      ) : null}

      <Card title={`Payments (${payments?.length ?? 0})`}>
        {(payments ?? []).length === 0 ? (
          <p className="px-4 py-3 text-[12.5px] text-brand-mute">
            No payment records — an EFT booking has none until the host records
            the transfer.
          </p>
        ) : (
          <ul className="divide-y divide-brand-line">
            {(payments ?? []).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-brand-ink">
                    {formatMoney(Number(p.amount), p.currency)} · {p.method}
                  </div>
                  <div className="truncate font-mono text-[11px] text-brand-mute">
                    {p.provider_reference ?? p.id}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-brand-mute">
                    {fmtDateTime(p.captured_at ?? p.created_at)}
                  </span>
                  <Pill>{p.status.replace(/_/g, " ")}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {booking.special_requests || booking.host_message ? (
        <Card title="Notes">
          {booking.special_requests ? (
            <Row label="Guest request" value={booking.special_requests} />
          ) : null}
          {booking.host_message ? (
            <Row label="Host message" value={booking.host_message} />
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white">
      <div className="border-b border-brand-line px-4 py-3">
        <h2 className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </h2>
      </div>
      {children}
    </section>
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

function Row({
  label,
  value,
  href,
  mono,
  strong,
}: {
  label: string;
  value: string;
  href?: string | null;
  mono?: boolean;
  strong?: boolean;
}) {
  const cls = `text-right text-[13px] ${mono ? "font-mono" : ""} ${
    strong ? "font-bold text-brand-ink" : "text-brand-ink"
  }`;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-line px-4 py-2.5 last:border-0">
      <span className="shrink-0 text-[12.5px] text-brand-mute">{label}</span>
      {href ? (
        <Link
          href={href}
          className={`${cls} text-brand-primary hover:underline`}
        >
          {value}
        </Link>
      ) : (
        <span className={cls}>{value}</span>
      )}
    </div>
  );
}

function PersonRow({
  name,
  sub,
  avatarUrl,
  lead,
}: {
  name: string;
  sub: string | null;
  avatarUrl: string | null;
  lead?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-brand-line px-4 py-3 last:border-0">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-accent font-display text-[12px] font-bold text-brand-secondary">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          (name.match(/\b\w/g) ?? []).slice(0, 2).join("").toUpperCase() || "G"
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-semibold text-brand-ink">
            {name}
          </span>
          {lead ? (
            <span className="shrink-0 rounded-pill bg-brand-primary/10 px-2 py-0.5 text-[10px] font-semibold text-brand-primary">
              Lead guest
            </span>
          ) : null}
        </div>
        {sub ? (
          <div className="truncate text-[12px] text-brand-mute">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-pill border border-brand-line bg-brand-light px-2.5 py-0.5 text-[11px] font-semibold capitalize text-brand-mute">
      {children}
    </span>
  );
}
