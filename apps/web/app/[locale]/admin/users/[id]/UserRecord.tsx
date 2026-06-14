"use client";

import { ExternalLink, Pencil, Shield, Trash2, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { RecordTabs } from "@/app/[locale]/dashboard/_components/RecordTabs";
import { formatZar } from "@/app/[locale]/dashboard/settings/subscription/plans";

import {
  addAdminUserNote,
  changeUserRole,
  reinstateUser,
  softDeleteUser,
  suspendUser,
  updateUserProfile,
} from "./actions";

export type UserRecordData = {
  user: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    role: string | null;
    is_active: boolean;
    is_lead: boolean | null;
    deleted_at: string | null;
    created_at: string | null;
    updated_at: string | null;
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
  counts: { bookingsAsGuest: number; listings: number; refunds: number };
  hostFinance: {
    collected: number;
    outstanding: number;
    refunded: number;
    net: number;
  } | null;
  viloLedger: {
    id: string;
    type: string;
    status: string;
    amount: number;
    reason: string | null;
    date: string;
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

type Dialog = "edit" | "role" | "suspend" | "delete" | null;

export function UserRecord({ data }: { data: UserRecordData }) {
  const router = useRouter();
  const { user, host } = data;
  const [tab, setTab] = useState("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pending, start] = useTransition();

  // form state
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [role, setRole] = useState(user.role ?? "guest");
  const [reason, setReason] = useState("");

  function close() {
    setDialog(null);
    setReason("");
  }

  function run(p: Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const r = await p;
      if (r.ok) {
        toast.success(ok);
        close();
        router.refresh();
      } else {
        toast.error(r.error ?? "Failed.");
      }
    });
  }

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "activity", label: "Activity" },
    { key: "finances", label: "Finances" },
    ...(host ? [{ key: "subscription", label: "Subscription" }] : []),
    { key: "notes", label: "Notes", count: data.notes.length },
    { key: "audit", label: "Audit", count: data.audit.length },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-mute hover:text-brand-primary"
      >
        ← All users
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar_url}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-secondary font-display text-lg font-bold text-white">
              {(user.full_name || user.email || "·").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-brand-ink">
                {user.full_name || "—"}
              </h1>
              <RolePill role={user.role} />
              {!user.is_active ? <Pill tone="bad">Suspended</Pill> : null}
              {user.deleted_at ? <Pill tone="bad">Deleted</Pill> : null}
              {user.is_lead ? <Pill tone="muted">Passwordless</Pill> : null}
            </div>
            <div className="font-mono text-xs text-brand-mute">
              {user.email}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setDialog("edit")}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("role")}>
            <UserCog className="mr-1.5 h-3.5 w-3.5" /> Role
          </Button>
          {user.is_active ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialog("suspend")}
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Suspend
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(
                  reinstateUser({
                    userId: user.id,
                    reason: "Reinstated by admin",
                  }),
                  "User reinstated.",
                )
              }
            >
              Reinstate
            </Button>
          )}
          {host ? (
            <Link
              href={`/admin/as/${user.id}/dashboard`}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-brand-line bg-white px-3 text-[13px] font-medium text-brand-ink hover:bg-brand-light"
            >
              View as host <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          {!user.deleted_at ? (
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-600 hover:bg-red-50"
              onClick={() => setDialog("delete")}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
            </Button>
          ) : null}
        </div>
      </header>

      {/* Stat band */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Bookings (guest)" value={data.counts.bookingsAsGuest} />
        <Stat label="Listings" value={data.counts.listings} />
        <Stat
          label="Paid to Vilo"
          value={formatZar(
            data.viloLedger
              .filter((t) => t.status === "completed" && t.amount > 0)
              .reduce((s, t) => s + t.amount, 0),
          )}
        />
        <Stat label="Member since" value={fmtDate(user.created_at)} />
      </section>

      <RecordTabs tabs={tabs} active={tab} onSelect={setTab} />

      {/* Panels */}
      {tab === "overview" ? (
        <Card>
          <Field label="Email" value={user.email} mono />
          <Field label="Phone" value={user.phone} mono />
          <Field
            label="Phone verified"
            value={
              user.phone_verified_at ? fmtDate(user.phone_verified_at) : "No"
            }
          />
          <Field
            label="ID verified"
            value={user.id_verified_at ? fmtDate(user.id_verified_at) : "No"}
          />
          <Field
            label="Account"
            value={user.is_lead ? "Passwordless (unclaimed)" : "Claimed"}
          />
          <Field label="Joined" value={fmtDate(user.created_at)} />
          {host ? (
            <Field
              label="Host"
              value={`@${host.handle} · ${host.is_verified ? "Verified" : "Unverified"}`}
            />
          ) : null}
        </Card>
      ) : null}

      {tab === "activity" ? (
        <Card>
          <Field
            label="Bookings as guest"
            value={data.counts.bookingsAsGuest}
          />
          <Field label="Refund requests" value={data.counts.refunds} />
          {host ? (
            <>
              <Field label="Listings" value={data.counts.listings} />
              <Field
                label="Bookings as host"
                value={host.total_bookings ?? 0}
              />
              <Field
                label="Rating"
                value={`${Number(host.avg_rating ?? 0).toFixed(1)}★ (${host.total_reviews ?? 0})`}
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {tab === "finances" ? (
        <div className="space-y-4">
          {host && data.hostFinance ? (
            <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
              <h3 className="mb-3 font-display text-sm font-bold text-brand-ink">
                Booking ledger (their guests → them)
              </h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat
                  label="Collected"
                  value={formatZar(data.hostFinance.collected)}
                />
                <Stat
                  label="Outstanding"
                  value={formatZar(data.hostFinance.outstanding)}
                />
                <Stat
                  label="Refunded"
                  value={formatZar(data.hostFinance.refunded)}
                />
                <Stat label="Net" value={formatZar(data.hostFinance.net)} />
              </div>
            </section>
          ) : null}
          <section className="rounded-card border border-brand-line bg-white shadow-card">
            <h3 className="border-b border-brand-line px-5 py-3 font-display text-sm font-bold text-brand-ink">
              Vilo account (them → Vilo)
            </h3>
            {data.viloLedger.length > 0 ? (
              <ul className="divide-y divide-brand-line">
                {data.viloLedger.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm"
                  >
                    <span className="w-20 capitalize text-brand-mute">
                      {t.type}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-brand-mute">
                      {fmtDate(t.date)}
                      {t.reason ? ` · ${t.reason}` : ""}
                      {t.status !== "completed" ? ` · ${t.status}` : ""}
                    </span>
                    <span
                      className={`num font-mono ${t.amount < 0 ? "text-status-cancelled" : "text-brand-ink"}`}
                    >
                      {t.amount < 0 ? "−" : ""}
                      {formatZar(Math.abs(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-sm text-brand-mute">
                No payments to Vilo yet.
              </p>
            )}
          </section>
        </div>
      ) : null}

      {tab === "subscription" && data.subscription ? (
        <Card>
          <Field label="Plan" value={data.subscription.plan} />
          <Field label="Status" value={data.subscription.status} />
          <Field label="Cycle" value={data.subscription.billing_cycle ?? "—"} />
          <Field
            label="Renews"
            value={fmtDate(data.subscription.current_period_end)}
          />
          <Field
            label="Trial ends"
            value={fmtDate(data.subscription.trial_ends_at)}
          />
          <Field
            label="Cancelling"
            value={data.subscription.cancel_at_period_end ? "Yes" : "No"}
          />
        </Card>
      ) : tab === "subscription" ? (
        <Card>
          <p className="text-sm text-brand-mute">No subscription on file.</p>
        </Card>
      ) : null}

      {tab === "notes" ? (
        <NotesPanel
          userId={user.id}
          notes={data.notes}
          onAdded={() => router.refresh()}
        />
      ) : null}

      {tab === "audit" ? (
        <section className="rounded-card border border-brand-line bg-white shadow-card">
          {data.audit.length > 0 ? (
            <ul className="divide-y divide-brand-line">
              {data.audit.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-5 py-2.5 text-sm"
                >
                  <span className="font-mono text-[12px] text-brand-ink">
                    {a.action}
                  </span>
                  {a.impersonating ? (
                    <Pill tone="muted">impersonated</Pill>
                  ) : null}
                  <span className="ml-auto font-mono text-[11px] text-brand-mute">
                    {fmtDate(a.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-brand-mute">
              No admin actions recorded on this user.
            </p>
          )}
        </section>
      ) : null}

      {/* ─── Dialogs ─── */}
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
            onClick={() =>
              run(
                updateUserProfile({ userId: user.id, fullName, phone }),
                "Profile updated.",
              )
            }
            disabled={pending}
          >
            Save
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "role"}
        onOpenChange={(o) => (o ? null : close())}
        title="Change role"
        description="Changing a role can grant or remove access across the app."
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
            disabled={pending || reason.trim().length < 5}
          >
            Change role
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={dialog === "suspend"}
        onOpenChange={(o) => (o ? null : close())}
        title="Suspend user"
        description="They won't be able to use the platform until reinstated."
      >
        <Lbl label="Reason (required)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Lbl>
        <FormModalFooter>
          <FormModalCancel onClick={close} />
          <Button
            className="bg-status-cancelled hover:bg-status-cancelled/90"
            onClick={() =>
              run(suspendUser({ userId: user.id, reason }), "User suspended.")
            }
            disabled={pending || reason.trim().length < 5}
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
            onClick={() =>
              run(softDeleteUser({ userId: user.id, reason }), "User deleted.")
            }
            disabled={pending || reason.trim().length < 5}
          >
            Delete
          </Button>
        </FormModalFooter>
      </FormModal>
    </div>
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
                } else {
                  toast.error(r.error ?? "Failed.");
                }
              })
            }
          >
            Add note
          </Button>
        </div>
      </div>
      <div className="rounded-card border border-brand-line bg-white shadow-card">
        {notes.length > 0 ? (
          <ul className="divide-y divide-brand-line">
            {notes.map((n) => (
              <li key={n.id} className="px-5 py-3 text-sm">
                <div className="whitespace-pre-wrap text-brand-ink">
                  {n.body}
                </div>
                <div className="mt-1 text-[11px] text-brand-mute">
                  {n.author ?? "Admin"} · {fmtDate(n.created_at)}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-brand-mute">No notes yet.</p>
        )}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | number | null;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </dt>
      <dd
        className={`mt-0.5 font-medium text-brand-ink ${mono ? "font-mono text-xs" : ""}`}
      >
        {value ?? "—"}
      </dd>
    </div>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </div>
      <div className="num mt-1 font-display text-lg font-bold text-brand-ink">
        {value}
      </div>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "bad" | "muted";
}) {
  const cls =
    tone === "bad"
      ? "border-status-cancelled/30 bg-status-cancelled/10 text-status-cancelled"
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
