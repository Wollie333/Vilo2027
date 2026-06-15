"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Calendar,
  CreditCard,
  ExternalLink,
  Gift,
  Home,
  LifeBuoy,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Shield,
  Star,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import { LedgerList } from "@/components/finance/LedgerList";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/format";
import type { Txn } from "@/lib/finance/transactions";

import {
  addAdminUserNote,
  changeUserRole,
  reinstateUser,
  requestSupportAccess,
  softDeleteUser,
  suspendUser,
  updateUserProfile,
} from "./actions";

type BookingLite = {
  id: string;
  reference: string;
  status: string;
  checkIn: string | null;
  checkOut: string | null;
  total: number;
  currency: string;
  listingName: string;
  counterparty: string | null;
};

type ReviewLite = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  isPublished: boolean;
  hostResponse: string | null;
  listingName: string;
  counterparty: string;
};

export type UserRecordData = {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    is_active: boolean;
    is_lead: boolean | null;
    country: string | null;
    deleted_at: string | null;
    created_at: string | null;
    phone_verified_at: string | null;
    id_verified_at: string | null;
    avatar_url: string | null;
  };
  host: {
    id: string;
    handle: string;
    display_name: string;
    is_verified: boolean;
    total_bookings: number | null;
    avg_rating: number | null;
    total_reviews: number | null;
  } | null;
  subscription: {
    plan: string;
    status: string;
    billing_cycle: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
  counts: { bookingsAsGuest: number; refunds: number; listings: number };
  listings: {
    id: string;
    name: string;
    location: string;
    isPublished: boolean;
    price: number;
    currency: string;
    slug: string | null;
  }[];
  businesses: {
    id: string;
    name: string;
    isDefault: boolean;
    isArchived: boolean;
  }[];
  bookingsAsGuest: BookingLite[];
  bookingsAsHost: BookingLite[];
  reviewsWritten: ReviewLite[];
  reviewsReceived: ReviewLite[];
  hostFinance: {
    collected: number;
    outstanding: number;
    refunded: number;
    net: number;
  } | null;
  hostTxns: Txn[];
  support: { active: boolean; status: string; expiresAt: string | null } | null;
  viloLedger: {
    id: string;
    type: string;
    status: string;
    amount: number;
    reason: string | null;
    date: string;
  }[];
  relationships: { id: string; name: string; email: string | null }[];
  dataRequests: {
    id: string;
    type: string;
    status: string;
    createdAt: string;
    fulfilledAt: string | null;
  }[];
  notes: {
    id: string;
    body: string;
    created_at: string;
    author: string | null;
  }[];
  audit: {
    id: string;
    action: string;
    created_at: string;
    impersonating: string | null;
  }[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function initials(name: string | null, email: string | null): string {
  const s = name || email || "·";
  const p = s.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "·";
}

type Dialog = "edit" | "role" | "suspend" | "delete" | "support" | null;

export function UserRecord({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, host } = data;
  const tab = params.get("tab") ?? "overview";

  const setTab = (t: string) => {
    const next = new URLSearchParams(params.toString());
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.push(`?${next.toString()}`);
  };

  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, start] = useTransition();
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState(user.role ?? "guest");
  const [reason, setReason] = useState("");

  const close = () => {
    setDialog(null);
    setReason("");
  };
  const run = (p: Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await p;
      if (r.ok) {
        toast.success(ok);
        close();
        router.refresh();
      } else toast.error(r.error ?? "Failed.");
    });

  const tabs = [
    { key: "overview", label: "Overview" },
    ...(host ? [{ key: "subscription", label: "Subscription" }] : []),
    { key: "bookings", label: "Bookings" },
    { key: "ledger", label: "Ledger" },
    ...(host
      ? [{ key: "listings", label: "Listings", count: data.listings.length }]
      : []),
    ...(host
      ? [{ key: "business", label: "Business", count: data.businesses.length }]
      : []),
    { key: "reviews", label: "Reviews" },
    {
      key: "relationships",
      label: "Relationships",
      count: data.relationships.length,
    },
    { key: "referrals", label: "Referrals" },
    {
      key: "support",
      label: "Support",
      count: data.dataRequests.length || undefined,
    },
    { key: "activity", label: "Activity" },
    { key: "notes", label: "Notes", count: data.notes.length },
    { key: "audit", label: "Audit", count: data.audit.length },
  ];

  return (
    <div className="w-full">
      {/* Sub-header */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/admin/users"
          className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-brand-line px-3 text-[13px] font-semibold text-brand-ink transition hover:bg-brand-light"
        >
          <ArrowLeft className="h-4 w-4 text-brand-mute" /> All users
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
        {/* Sticky dossier */}
        <aside className="lg:sticky lg:top-6">
          <Dossier
            data={data}
            onEdit={() => setDialog("edit")}
            onRole={() => setDialog("role")}
            onSuspend={() => setDialog("suspend")}
            onDelete={() => setDialog("delete")}
            onReinstate={() =>
              run(
                reinstateUser({
                  userId: user.id,
                  reason: "Reinstated by admin",
                }),
                "User reinstated.",
              )
            }
            pending={pending}
          />
        </aside>

        {/* Working column */}
        <div className="flex min-w-0 flex-col gap-5">
          <RecordTabs active={tab} onSelect={setTab} tabs={tabs} />
          <div>
            {tab === "overview" ? <OverviewPanel data={data} /> : null}
            {tab === "subscription" ? <SubscriptionPanel data={data} /> : null}
            {tab === "bookings" ? (
              <BookingsPanel
                data={data}
                onRequestSupport={() => setDialog("support")}
              />
            ) : null}
            {tab === "ledger" ? (
              <LedgerPanel
                data={data}
                onRequestSupport={() => setDialog("support")}
              />
            ) : null}
            {tab === "listings" ? <ListingsPanel data={data} /> : null}
            {tab === "business" ? <BusinessPanel data={data} /> : null}
            {tab === "reviews" ? <ReviewsPanel data={data} /> : null}
            {tab === "relationships" ? (
              <RelationshipsPanel data={data} />
            ) : null}
            {tab === "referrals" ? <ReferralsPanel /> : null}
            {tab === "support" ? <SupportPanel data={data} /> : null}
            {tab === "activity" ? <ActivityPanel data={data} /> : null}
            {tab === "notes" ? (
              <NotesPanel
                userId={user.id}
                notes={data.notes}
                onAdded={() => router.refresh()}
              />
            ) : null}
            {tab === "audit" ? <AuditPanel data={data} /> : null}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <FormModal
        open={dialog === "edit"}
        onOpenChange={(o) => (o ? null : close())}
        title="Edit profile"
      >
        <div className="space-y-4">
          <Lbl label="Full name">
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Lbl>
          <Lbl label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Lbl>
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending}
            onClick={() =>
              run(
                updateUserProfile({ userId: user.id, fullName, phone }),
                "Profile updated.",
              )
            }
          >
            Save
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "role"}
        onOpenChange={(o) => (o ? null : close())}
        title="Change role"
        description="Changing a role grants or removes access across the app."
      >
        <div className="space-y-4">
          <Lbl label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="guest">guest</option>
              <option value="host">host</option>
              <option value="staff">staff</option>
              <option value="super_admin">super_admin</option>
            </select>
          </Lbl>
          <Lbl label="Reason (required)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Lbl>
        </div>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(
                changeUserRole({
                  userId: user.id,
                  role: role as "guest" | "host" | "staff" | "super_admin",
                  reason,
                }),
                "Role updated.",
              )
            }
          >
            Change role
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "suspend"}
        onOpenChange={(o) => (o ? null : close())}
        title="Suspend user"
        description="They can't use the platform until reinstated."
      >
        <Lbl label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            className="bg-status-cancelled hover:bg-status-cancelled/90"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(suspendUser({ userId: user.id, reason }), "User suspended.")
            }
          >
            Suspend
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "delete"}
        onOpenChange={(o) => (o ? null : close())}
        title="Delete user"
        description="Soft-delete (recoverable). The account is hidden and deactivated."
      >
        <Lbl label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            className="bg-status-cancelled hover:bg-status-cancelled/90"
            disabled={pending || reason.trim().length < 5}
            onClick={() =>
              run(softDeleteUser({ userId: user.id, reason }), "User deleted.")
            }
          >
            Delete
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "support"}
        onOpenChange={(o) => (o ? null : close())}
        title="Request edit access"
        description="The host is notified and must approve before you can edit their financial records. Approved access lasts 72 hours."
      >
        <Lbl label="Reason (shown to the host)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            disabled={pending || reason.trim().length < 5 || !host}
            onClick={() =>
              host
                ? run(
                    requestSupportAccess({ hostId: host.id, reason }),
                    "Request sent to the host.",
                  )
                : undefined
            }
          >
            Send request
          </Button>
        </FormModalFooter>
      </FormModal>
    </div>
  );
}

// Shows on financial tabs: read-only notice + request-access, or the active grant.
function SupportBanner({
  support,
  isHost,
  onRequest,
}: {
  support: UserRecordData["support"];
  isHost: boolean;
  onRequest: () => void;
}) {
  if (!isHost) return null;
  if (support?.active) {
    return (
      <div className="rounded-card border border-status-confirmed/30 bg-status-confirmed/10 px-4 py-2.5 text-[12.5px] font-semibold text-status-confirmed">
        Host-approved edit access is active
        {support.expiresAt
          ? ` until ${new Date(support.expiresAt).toLocaleString("en-ZA", {
              dateStyle: "medium",
              timeStyle: "short",
            })}`
          : ""}
        .
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
      <span>
        Financial records are <span className="font-semibold">read-only</span>.
        {support?.status === "pending"
          ? " A support request is awaiting the host's approval."
          : " Request the host's permission to make changes."}
      </span>
      {support?.status !== "pending" ? (
        <button
          type="button"
          onClick={onRequest}
          className="rounded-pill bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700"
        >
          Request edit access
        </button>
      ) : null}
    </div>
  );
}

// ── Dossier ──────────────────────────────────────────────────────────────
function Dossier({
  data,
  onEdit,
  onRole,
  onSuspend,
  onDelete,
  onReinstate,
  pending,
}: {
  data: UserRecordData;
  onEdit: () => void;
  onRole: () => void;
  onSuspend: () => void;
  onDelete: () => void;
  onReinstate: () => void;
  pending: boolean;
}) {
  const { user, host } = data;
  const sep = <div className="h-px bg-brand-line" />;
  const eyebrow =
    "text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-mute";
  const paidToVilo = data.viloLedger
    .filter((t) => t.status === "completed" && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex flex-col gap-5 p-6">
        {/* identity */}
        <div className="flex items-start gap-3.5">
          <div className="relative shrink-0">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt=""
                className="h-16 w-16 rounded-pill object-cover ring-2 ring-brand-accent"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-brand-secondary font-display text-xl font-bold text-white ring-2 ring-brand-accent">
                {initials(user.full_name, user.email)}
              </div>
            )}
            {host?.is_verified ? (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-brand-primary text-white">
                <BadgeCheck className="h-3 w-3" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[20px] font-extrabold leading-tight text-brand-ink">
              {user.full_name ?? "—"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <RolePill role={user.role} />
              {!user.is_active ? <Pill tone="bad">Suspended</Pill> : null}
              {user.deleted_at ? <Pill tone="bad">Deleted</Pill> : null}
              {user.is_lead ? <Pill tone="muted">Passwordless</Pill> : null}
            </div>
          </div>
        </div>

        {/* quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <ActBtn icon={Pencil} label="Edit" onClick={onEdit} />
          <ActBtn icon={UserCog} label="Role" onClick={onRole} />
          {user.is_active ? (
            <ActBtn icon={Shield} label="Suspend" onClick={onSuspend} />
          ) : (
            <ActBtn
              icon={Shield}
              label="Reinstate"
              onClick={onReinstate}
              disabled={pending}
            />
          )}
          {!user.deleted_at ? (
            <ActBtn icon={Trash2} label="Delete" onClick={onDelete} danger />
          ) : null}
        </div>
        {host ? (
          <Link
            href={`/admin/as/${user.id}/dashboard`}
            className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand-primary px-3.5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-brand-secondary"
          >
            <ExternalLink className="h-4 w-4" /> View as host
          </Link>
        ) : null}

        {sep}

        {/* contact */}
        <div>
          <div className={`${eyebrow} mb-2.5`}>Contact</div>
          <div className="flex flex-col gap-2.5 text-[12.5px]">
            {user.email ? (
              <a
                href={`mailto:${user.email}`}
                className="flex items-center gap-2.5 text-brand-ink hover:text-brand-primary"
              >
                <Mail className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="truncate">{user.email}</span>
              </a>
            ) : null}
            {user.phone ? (
              <a
                href={`tel:${user.phone}`}
                className="flex items-center gap-2.5 text-brand-ink hover:text-brand-primary"
              >
                <Phone className="h-4 w-4 shrink-0 text-brand-mute" />
                <span className="truncate">{user.phone}</span>
              </a>
            ) : null}
            {user.country ? (
              <div className="flex items-center gap-2.5 text-brand-mute">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{user.country}</span>
              </div>
            ) : null}
            <div className="flex items-center gap-2.5 text-brand-mute">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>Joined {fmtDate(user.created_at)}</span>
            </div>
          </div>
        </div>

        {sep}

        {/* verification */}
        <div>
          <div className={`${eyebrow} mb-2.5`}>Verified</div>
          <div className="flex flex-wrap gap-1.5">
            {user.phone_verified_at ? <Pill tone="good">Phone</Pill> : null}
            {user.id_verified_at ? <Pill tone="good">ID</Pill> : null}
            {host?.is_verified ? <Pill tone="good">Host verified</Pill> : null}
            {!user.phone_verified_at &&
            !user.id_verified_at &&
            !host?.is_verified ? (
              <span className="text-[12px] text-brand-mute">
                Nothing verified yet.
              </span>
            ) : null}
          </div>
        </div>

        {sep}

        {/* lifetime */}
        <div>
          <div className={`${eyebrow} mb-3`}>Lifetime</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DStat
              label="Bookings (guest)"
              value={String(data.counts.bookingsAsGuest)}
            />
            <DStat
              label="Paid to Vilo"
              value={formatMoney(paidToVilo, "ZAR")}
            />
            {host ? (
              <DStat label="Listings" value={String(data.counts.listings)} />
            ) : null}
            {host ? (
              <DStat
                label="Host rating"
                value={
                  host.avg_rating
                    ? `${Number(host.avg_rating).toFixed(1)} ★`
                    : "—"
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Panels ───────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  count,
  children,
  empty,
}: {
  icon: typeof Calendar;
  title: string;
  count: number;
  children: React.ReactNode;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-brand-line px-5 py-3.5">
        <Icon className="h-4 w-4 text-brand-mute" />
        <span className="font-display text-[15px] font-bold text-brand-ink">
          {title}
        </span>
        <span className="rounded-pill border border-brand-line bg-brand-light px-1.5 py-px text-[10.5px] tabular-nums text-brand-mute">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <div className="px-5 py-8 text-center text-[12.5px] text-brand-mute">
          {empty}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}

function RowLink({
  href,
  primary,
  secondary,
  amount,
  status,
}: {
  href?: string;
  primary: string;
  secondary: string;
  amount?: string;
  status?: string;
}) {
  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-brand-ink">
          {primary}
        </div>
        <div className="mt-0.5 truncate text-[11.5px] text-brand-mute">
          {secondary}
        </div>
      </div>
      {amount ? (
        <div className="font-display text-[13px] font-bold tabular-nums text-brand-ink">
          {amount}
        </div>
      ) : null}
      {status ? (
        <span className="shrink-0 rounded-pill border border-brand-line bg-brand-light px-2 py-0.5 text-[11px] font-semibold capitalize text-brand-mute">
          {status.replace(/_/g, " ")}
        </span>
      ) : null}
      {href ? (
        <ArrowRight className="h-4 w-4 shrink-0 text-brand-mute" />
      ) : null}
    </>
  );
  const cls =
    "flex items-center gap-3 border-t border-brand-line px-5 py-3 first:border-t-0";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-brand-light/50`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function OverviewPanel({ data }: { data: UserRecordData }) {
  const { user, host } = data;
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact k="Email" v={user.email} mono />
        <Fact k="Phone" v={user.phone} mono />
        <Fact k="Role" v={user.role} />
        <Fact
          k="Account"
          v={user.is_lead ? "Passwordless (unclaimed)" : "Claimed"}
        />
        <Fact k="Country" v={user.country} />
        <Fact k="Joined" v={fmtDate(user.created_at)} />
        {host ? <Fact k="Host handle" v={`@${host.handle}`} /> : null}
        {host ? (
          <Fact k="Bookings as host" v={String(host.total_bookings ?? 0)} />
        ) : null}
      </dl>
    </section>
  );
}

function SubscriptionPanel({ data }: { data: UserRecordData }) {
  const s = data.subscription;
  if (!s)
    return (
      <section className="rounded-card border border-brand-line bg-white p-5 text-sm text-brand-mute shadow-card">
        No subscription on file.
      </section>
    );
  return (
    <section className="overflow-hidden rounded-card border border-brand-line bg-white p-5 shadow-card">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact k="Plan" v={s.plan} />
        <Fact k="Status" v={s.status} />
        <Fact k="Cycle" v={s.billing_cycle} />
        <Fact k="Renews" v={fmtDate(s.current_period_end)} />
        <Fact k="Trial ends" v={fmtDate(s.trial_ends_at)} />
        <Fact k="Cancelling" v={s.cancel_at_period_end ? "Yes" : "No"} />
      </dl>
      <Link
        href="/admin/subscriptions"
        className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-primary hover:underline"
      >
        Manage in Subscriptions <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function BookingsPanel({
  data,
  onRequestSupport,
}: {
  data: UserRecordData;
  onRequestSupport: () => void;
}) {
  return (
    <div className="space-y-6">
      <SupportBanner
        support={data.support}
        isHost={!!data.host}
        onRequest={onRequestSupport}
      />
      <Section
        icon={Calendar}
        title="As guest"
        count={data.bookingsAsGuest.length}
        empty="No bookings as a guest."
      >
        {data.bookingsAsGuest.map((b) => (
          <RowLink
            key={b.id}
            href={`/dashboard/bookings/${b.id}`}
            primary={b.listingName}
            secondary={`${b.reference} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}`}
            amount={formatMoney(b.total, b.currency)}
            status={b.status}
          />
        ))}
      </Section>
      {data.host ? (
        <Section
          icon={Calendar}
          title="As host"
          count={data.bookingsAsHost.length}
          empty="No bookings hosted yet."
        >
          {data.bookingsAsHost.map((b) => (
            <RowLink
              key={b.id}
              href={`/dashboard/bookings/${b.id}`}
              primary={b.listingName}
              secondary={`${b.reference} · ${b.counterparty ?? ""} · ${fmtDate(b.checkIn)}`}
              amount={formatMoney(b.total, b.currency)}
              status={b.status}
            />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function LedgerPanel({
  data,
  onRequestSupport,
}: {
  data: UserRecordData;
  onRequestSupport: () => void;
}) {
  return (
    <div className="space-y-6">
      <SupportBanner
        support={data.support}
        isHost={!!data.host}
        onRequest={onRequestSupport}
      />
      {data.host && data.hostFinance ? (
        <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
          <h3 className="mb-3 font-display text-sm font-bold text-brand-ink">
            Booking ledger (their guests → them)
          </h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <MiniKpi
              label="Collected"
              value={formatMoney(data.hostFinance.collected, "ZAR")}
            />
            <MiniKpi
              label="Outstanding"
              value={formatMoney(data.hostFinance.outstanding, "ZAR")}
            />
            <MiniKpi
              label="Refunded"
              value={formatMoney(data.hostFinance.refunded, "ZAR")}
            />
            <MiniKpi
              label="Net"
              value={formatMoney(data.hostFinance.net, "ZAR")}
            />
          </div>
          <LedgerList
            entries={data.hostTxns}
            showGuest
            emptyLabel="No booking transactions yet."
            minWidth={720}
          />
        </section>
      ) : null}
      <Section
        icon={CreditCard}
        title="Vilo account (them → Vilo)"
        count={data.viloLedger.length}
        empty="No payments to Vilo yet."
      >
        {data.viloLedger.map((t) => (
          <RowLink
            key={t.id}
            primary={`${t.type[0].toUpperCase()}${t.type.slice(1)}`}
            secondary={`${fmtDate(t.date)}${t.reason ? ` · ${t.reason}` : ""}${t.status !== "completed" ? ` · ${t.status}` : ""}`}
            amount={`${t.amount < 0 ? "−" : ""}${formatMoney(Math.abs(t.amount), "ZAR")}`}
          />
        ))}
      </Section>
    </div>
  );
}

function ListingsPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={Home}
      title="Listings"
      count={data.listings.length}
      empty="No listings."
    >
      {data.listings.map((l) => (
        <RowLink
          key={l.id}
          href={l.slug ? `/listing/${l.slug}` : undefined}
          primary={l.name}
          secondary={`${l.location || "—"} · from ${formatMoney(l.price, l.currency)}`}
          status={l.isPublished ? "published" : "draft"}
        />
      ))}
    </Section>
  );
}

function BusinessPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={Home}
      title="Businesses"
      count={data.businesses.length}
      empty="No businesses."
    >
      {data.businesses.map((b) => (
        <RowLink
          key={b.id}
          primary={b.name}
          secondary={b.isDefault ? "Default business" : "Business"}
          status={b.isArchived ? "archived" : "active"}
        />
      ))}
    </Section>
  );
}

function ReviewCardLite({
  rev,
  counterLabel,
}: {
  rev: ReviewLite;
  counterLabel: string;
}) {
  return (
    <div className="border-t border-brand-line px-5 py-4 first:border-t-0">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-ink">
          {rev.rating}{" "}
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
        </span>
        <span className="text-[12px] text-brand-mute">
          {rev.listingName} · {counterLabel} {rev.counterparty} ·{" "}
          {fmtDate(rev.createdAt)}
        </span>
        {!rev.isPublished ? <Pill tone="muted">unpublished</Pill> : null}
      </div>
      {rev.body ? (
        <p className="mt-2 text-[13px] text-brand-ink">{rev.body}</p>
      ) : null}
      {rev.hostResponse ? (
        <p className="mt-2 rounded-md bg-brand-light px-3 py-2 text-[12.5px] text-brand-mute">
          Host: {rev.hostResponse}
        </p>
      ) : null}
    </div>
  );
}

function ReviewsPanel({ data }: { data: UserRecordData }) {
  return (
    <div className="space-y-6">
      <Section
        icon={Star}
        title="Written (as guest)"
        count={data.reviewsWritten.length}
        empty="No reviews written."
      >
        {data.reviewsWritten.map((rv) => (
          <ReviewCardLite key={rv.id} rev={rv} counterLabel="for" />
        ))}
      </Section>
      {data.host ? (
        <Section
          icon={Star}
          title="Received (as host)"
          count={data.reviewsReceived.length}
          empty="No reviews received."
        >
          {data.reviewsReceived.map((rv) => (
            <ReviewCardLite key={rv.id} rev={rv} counterLabel="from" />
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function RelationshipsPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={Users}
      title="Travelled with"
      count={data.relationships.length}
      empty="No travel connections yet."
    >
      {data.relationships.map((rel) => (
        <RowLink
          key={rel.id}
          primary={rel.name}
          secondary={rel.email ?? "No email"}
        />
      ))}
    </Section>
  );
}

function ReferralsPanel() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white px-6 py-12 text-center">
      <Gift className="mx-auto h-6 w-6 text-brand-line" />
      <p className="mt-3 text-[13px] text-brand-mute">
        No referrals yet. When this user refers others, the people they brought
        to Vilo will appear here.
      </p>
    </div>
  );
}

function SupportPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={LifeBuoy}
      title="Data & privacy requests"
      count={data.dataRequests.length}
      empty="No support / data requests from this user."
    >
      {data.dataRequests.map((d) => (
        <RowLink
          key={d.id}
          href="/admin/data-requests"
          primary={
            d.type === "export"
              ? "Data export request"
              : "Account deletion request"
          }
          secondary={`Raised ${fmtDate(d.createdAt)}${d.fulfilledAt ? ` · done ${fmtDate(d.fulfilledAt)}` : ""}`}
          status={d.status}
        />
      ))}
    </Section>
  );
}

function ActivityPanel({ data }: { data: UserRecordData }) {
  const items: { id: string; label: string; date: string; sub: string }[] = [];
  for (const b of data.bookingsAsGuest)
    items.push({
      id: `bg-${b.id}`,
      label: `Booked ${b.listingName}`,
      date: b.checkIn ?? "",
      sub: `${b.reference} · ${b.status}`,
    });
  for (const rv of data.reviewsWritten)
    items.push({
      id: `rw-${rv.id}`,
      label: `Reviewed ${rv.listingName}`,
      date: rv.createdAt,
      sub: `${rv.rating}★`,
    });
  for (const a of data.audit)
    items.push({
      id: `au-${a.id}`,
      label: `Admin: ${a.action}`,
      date: a.created_at,
      sub: a.impersonating ? "impersonated" : "",
    });
  for (const d of data.dataRequests)
    items.push({
      id: `dr-${d.id}`,
      label: `Data ${d.type} request`,
      date: d.createdAt,
      sub: d.status,
    });
  items.sort((x, y) => (x.date < y.date ? 1 : -1));

  return (
    <Section
      icon={Calendar}
      title="Activity log"
      count={items.length}
      empty="No recorded activity."
    >
      {items.slice(0, 60).map((it) => (
        <RowLink
          key={it.id}
          primary={it.label}
          secondary={`${fmtDate(it.date)}${it.sub ? ` · ${it.sub}` : ""}`}
        />
      ))}
    </Section>
  );
}

function NotesPanel({
  userId,
  notes,
  onAdded,
}: {
  userId: string;
  notes: UserRecordData["notes"];
  onAdded: () => void;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add an internal note about this user…"
          className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={pending || !body.trim()}
            onClick={() =>
              start(async () => {
                const r = await addAdminUserNote({ userId, body });
                if (r.ok) {
                  toast.success("Note added.");
                  setBody("");
                  onAdded();
                } else toast.error(r.error ?? "Failed.");
              })
            }
          >
            Add note
          </Button>
        </div>
      </div>
      <Section
        icon={Pencil}
        title="Notes"
        count={notes.length}
        empty="No notes yet."
      >
        {notes.map((n) => (
          <div
            key={n.id}
            className="border-t border-brand-line px-5 py-3 first:border-t-0"
          >
            <div className="whitespace-pre-wrap text-[13px] text-brand-ink">
              {n.body}
            </div>
            <div className="mt-1 text-[11px] text-brand-mute">
              {n.author ?? "Admin"} · {fmtDate(n.created_at)}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

function AuditPanel({ data }: { data: UserRecordData }) {
  return (
    <Section
      icon={Shield}
      title="Audit trail"
      count={data.audit.length}
      empty="No admin actions recorded."
    >
      {data.audit.map((a) => (
        <RowLink
          key={a.id}
          primary={a.action}
          secondary={fmtDate(a.created_at)}
          status={a.impersonating ? "impersonated" : undefined}
        />
      ))}
    </Section>
  );
}

// ── Small UI bits ──────────────────────────────────────────────────────────
function Fact({ k, v, mono }: { k: string; v: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {k}
      </dt>
      <dd
        className={`mt-0.5 font-medium text-brand-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {v ?? "—"}
      </dd>
    </div>
  );
}
function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-brand-line bg-brand-light/40 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-base font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}
function DStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-[19px] font-bold leading-none text-brand-ink">
        {value}
      </div>
    </div>
  );
}
function ActBtn({
  icon: Icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-pill border px-3 py-2 text-[12.5px] font-semibold transition disabled:opacity-50 ${
        danger
          ? "border-red-200 text-red-600 hover:bg-red-50"
          : "border-brand-line text-brand-ink hover:bg-brand-light"
      }`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
function Lbl({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "bad" | "muted" | "good";
}) {
  const cls =
    tone === "bad"
      ? "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled"
      : tone === "good"
        ? "border-status-confirmed/30 bg-status-confirmed/10 text-status-confirmed"
        : "border-brand-line bg-brand-light text-brand-mute";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium ${cls}`}
    >
      {children}
    </span>
  );
}
function RolePill({ role }: { role: string | null }) {
  const primary = role === "super_admin" || role === "staff" || role === "host";
  const cls = primary
    ? "bg-brand-accent text-brand-primary border-brand-primary/20"
    : "bg-brand-light text-brand-mute border-brand-line";
  return (
    <span
      className={`inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {(role ?? "guest").replace(/_/g, " ")}
    </span>
  );
}
