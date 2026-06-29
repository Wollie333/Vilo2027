"use client";

import { Loader2, Mail, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addHostStaff, inviteHostStaff, removeHostStaff } from "./actions";

type StaffRow = {
  userId: string;
  email: string | null;
  fullName: string | null;
};

export function HostStaffManager({
  hostId,
  staff,
}: {
  hostId: string;
  staff: StaffRow[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();

  function run(p: Promise<{ ok: boolean; error?: string }>, ok: string) {
    start(async () => {
      const res = await p;
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed.");
      }
    });
  }

  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-mute">
        Staff
      </div>
      <p className="mt-1 text-[12px] text-brand-mute">
        Users assigned to help manage this host&apos;s listings &amp; bookings.
      </p>

      <ul className="mt-3 space-y-2">
        {staff.map((s) => (
          <li
            key={s.userId}
            className="flex items-center justify-between gap-2 rounded border border-brand-line px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-brand-ink">
                {s.fullName ?? s.email ?? s.userId.slice(0, 8)}
              </div>
              {s.email ? (
                <div className="truncate font-mono text-[11px] text-brand-mute">
                  {s.email}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  removeHostStaff({ hostId, userId: s.userId }),
                  "Staff removed.",
                )
              }
              className="inline-flex shrink-0 items-center gap-1 rounded border border-brand-line bg-white px-2 py-1 text-[11.5px] font-medium text-brand-mute transition-colors hover:bg-brand-light hover:text-status-cancelled disabled:opacity-50"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          </li>
        ))}
        {staff.length === 0 ? (
          <li className="rounded border border-dashed border-brand-line px-3 py-3 text-center text-[12px] text-brand-mute">
            No staff assigned.
          </li>
        ) : null}
      </ul>

      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-semibold text-brand-ink">
            Add staff by email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1 w-full rounded-[10px] border border-brand-line px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </div>
        <button
          type="button"
          disabled={pending || !email.trim()}
          title="Assign instantly (no acceptance step)"
          onClick={() => {
            run(addHostStaff({ hostId, email: email.trim() }), "Staff added.");
            setEmail("");
          }}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Add
        </button>
        <button
          type="button"
          disabled={pending || !email.trim()}
          title="Email an invite link the user must accept"
          onClick={() => {
            run(
              inviteHostStaff({ hostId, email: email.trim() }),
              "Invite sent.",
            );
            setEmail("");
          }}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          <Mail className="h-4 w-4" /> Invite
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-brand-mute">
        <strong>Add</strong> assigns instantly · <strong>Invite</strong> emails
        a link the user accepts.
      </p>
    </section>
  );
}
