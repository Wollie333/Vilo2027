"use client";

import { Check, Copy, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { modal } from "@/components/ui/modal-host";

import {
  cancelInviteAction,
  inviteStaffAction,
  removeStaffAction,
  resendInviteAction,
  updateStaffRoleAction,
} from "./actions";
import { STAFF_ROLES, STAFF_ROLE_LABEL, type StaffRole } from "./schemas";

export type StaffMemberCard = {
  id: string;
  role: StaffRole;
  createdAt: string;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export type PendingInviteCard = {
  id: string;
  email: string;
  role: StaffRole;
  expiresAt: string;
  createdAt: string;
  url: string;
};

export function StaffManager({
  members,
  invites,
  seatLimit,
  used,
  inviteBaseUrl,
}: {
  members: StaffMemberCard[];
  invites: PendingInviteCard[];
  seatLimit: number;
  used: number;
  inviteBaseUrl: string;
}) {
  const router = useRouter();
  const canInvite = seatLimit >= 1 && used < seatLimit;
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);

  function refresh() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <InviteForm
        canInvite={canInvite}
        seatLimit={seatLimit}
        used={used}
        inviteBaseUrl={inviteBaseUrl}
        onCreated={(url) => {
          setCreatedInviteUrl(url);
          refresh();
        }}
      />

      {createdInviteUrl ? (
        <FreshInviteBanner
          url={createdInviteUrl}
          onDismiss={() => setCreatedInviteUrl(null)}
        />
      ) : null}

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Active staff
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Each member uses one seat. Roles can be changed any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-6 text-center text-sm text-brand-mute">
              No staff yet. Invite someone above to get started.
            </p>
          ) : (
            <ul className="divide-y divide-brand-line">
              {members.map((m) => (
                <MemberRow key={m.id} member={m} onChange={refresh} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-card border-brand-line shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Pending invites
          </CardTitle>
          <CardDescription className="text-brand-mute">
            Send the URL via WhatsApp, email or your usual channel — they click
            it to join.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="rounded border border-dashed border-brand-line bg-brand-light/40 px-4 py-6 text-center text-sm text-brand-mute">
              No pending invites.
            </p>
          ) : (
            <ul className="space-y-3">
              {invites.map((i) => (
                <InviteRow key={i.id} invite={i} onChange={refresh} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InviteForm({
  canInvite,
  seatLimit,
  used,
  inviteBaseUrl,
  onCreated,
}: {
  canInvite: boolean;
  seatLimit: number;
  used: number;
  inviteBaseUrl: string;
  onCreated: (url: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("assistant");
  const [pending, start] = useTransition();

  function submit() {
    if (!email.trim()) {
      toast.error("Add an email first.");
      return;
    }
    start(async () => {
      const r = await inviteStaffAction({ email: email.trim(), role });
      if (r.ok && r.data) {
        toast.success("Invite created");
        setEmail("");
        onCreated(`${inviteBaseUrl}${r.data.token}`);
      } else if (!r.ok) {
        toast.error(r.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Invite a teammate
        </CardTitle>
        <CardDescription className="text-brand-mute">
          {seatLimit < 1
            ? "Upgrade your plan to unlock staff seats."
            : `${used} of ${seatLimit} seats used. We'll generate a link you can share.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            disabled={!canInvite || pending}
          />
          <Button
            type="button"
            onClick={submit}
            disabled={!canInvite || pending}
            className="gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            {pending ? "Creating…" : "Create invite"}
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {STAFF_ROLES.map((opt) => {
            const active = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRole(opt.value)}
                disabled={!canInvite || pending}
                className={`rounded-card border p-3 text-left transition-colors ${
                  active
                    ? "border-brand-primary bg-brand-accent/50"
                    : "border-brand-line bg-white hover:bg-brand-light/60"
                } ${!canInvite ? "opacity-50" : ""}`}
              >
                <div className="font-display text-sm font-semibold text-brand-dark">
                  {opt.label}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                  {opt.body}
                </p>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function FreshInviteBanner({
  url,
  onDismiss,
}: {
  url: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        toast.success("Invite URL copied");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy — copy it manually."));
  }
  return (
    <div className="rounded-card border border-brand-primary bg-brand-accent/40 p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold text-brand-deep">
            Invite ready — share this URL
          </div>
          <code className="mt-2 block overflow-x-auto rounded border border-brand-line bg-white px-3 py-2 font-mono text-[11px] text-brand-ink">
            {url}
          </code>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={copy} className="gap-1.5">
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  onChange,
}: {
  member: StaffMemberCard;
  onChange: () => void;
}) {
  const [pending, start] = useTransition();
  const initials = (member.fullName || member.email || "??")
    .slice(0, 2)
    .toUpperCase();

  function changeRole(next: StaffRole) {
    if (next === member.role) return;
    start(async () => {
      const r = await updateStaffRoleAction(member.id, { role: next });
      if (r.ok) {
        toast.success("Role updated");
        onChange();
      } else toast.error(r.error);
    });
  }
  async function remove() {
    const ok = await modal.destructive({
      title: `Remove ${member.fullName || member.email} from your team?`,
      description: "This removes their access immediately.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    start(async () => {
      const r = await removeStaffAction(member.id);
      if (r.ok) {
        toast.success("Removed");
        onChange();
      } else toast.error(r.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-sm font-bold text-brand-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-brand-ink">
          {member.fullName || member.email || "Unknown"}
        </div>
        <div className="truncate text-xs text-brand-mute">
          {member.email ?? ""} · Joined{" "}
          {new Date(member.createdAt).toLocaleDateString("en-ZA")}
        </div>
      </div>
      <select
        value={member.role}
        onChange={(e) => changeRole(e.target.value as StaffRole)}
        disabled={pending}
        className="rounded border border-brand-line bg-white px-3 py-1.5 text-sm text-brand-ink"
        aria-label="Role"
      >
        {Object.entries(STAFF_ROLE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        onClick={remove}
        disabled={pending}
        className="gap-1.5 text-status-cancelled hover:bg-red-50"
      >
        <Trash2 className="h-4 w-4" />
        Remove
      </Button>
    </li>
  );
}

function InviteRow({
  invite,
  onChange,
}: {
  invite: PendingInviteCard;
  onChange: () => void;
}) {
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  const expiresIn = Math.max(
    0,
    Math.ceil((new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000),
  );

  function copy() {
    navigator.clipboard
      .writeText(invite.url)
      .then(() => {
        setCopied(true);
        toast.success("Invite URL copied");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy — copy it manually."));
  }
  async function cancel() {
    const ok = await modal.destructive({
      title: `Cancel the invite for ${invite.email}?`,
      description: "The invite link will stop working.",
      confirmLabel: "Cancel invite",
      cancelLabel: "Keep invite",
    });
    if (!ok) return;
    start(async () => {
      const r = await cancelInviteAction(invite.id);
      if (r.ok) {
        toast.success("Invite cancelled");
        onChange();
      } else toast.error(r.error);
    });
  }
  function resend() {
    start(async () => {
      const r = await resendInviteAction(invite.id);
      if (r.ok) {
        toast.success("Invite refreshed — copy the new URL");
        onChange();
      } else toast.error(r.error);
    });
  }

  return (
    <li className="rounded border border-brand-line bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Mail className="h-4 w-4 text-brand-mute" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-brand-ink">
            {invite.email}
          </div>
          <div className="text-[11px] text-brand-mute">
            {STAFF_ROLE_LABEL[invite.role]} · Expires in {expiresIn} day
            {expiresIn === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={copy}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy URL
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resend}
            disabled={pending}
            className="gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={cancel}
            disabled={pending}
            className="gap-1.5 text-status-cancelled hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" /> Cancel
          </Button>
        </div>
      </div>
      <code className="mt-2 block overflow-x-auto rounded border border-brand-line bg-brand-light/40 px-3 py-1.5 font-mono text-[11px] text-brand-ink">
        {invite.url}
      </code>
    </li>
  );
}
