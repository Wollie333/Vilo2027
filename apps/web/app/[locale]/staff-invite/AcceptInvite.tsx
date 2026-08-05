"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { acceptStaffInvite } from "@/app/[locale]/admin/platform/staff/actions";
import { createClient } from "@/lib/supabase/client";

export function AcceptInvite({
  token,
  inviteEmail,
  matches,
}: {
  token: string;
  inviteEmail: string;
  matches: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const autoRan = useRef(false);

  const accept = () => {
    setError(null);
    start(async () => {
      const res = await acceptStaffInvite(token);
      if (res.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  };

  // Already signed in as the invited email → activate automatically, no click.
  useEffect(() => {
    if (matches && !autoRan.current) {
      autoRan.current = true;
      accept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches]);

  // Signed in as the wrong account: sign out, then send them to sign in (or
  // create an account) with the invited email. On return the invite auto-accepts.
  const switchAccount = async () => {
    setSwitching(true);
    try {
      await createClient().auth.signOut();
    } catch {
      // Redirect regardless — the login page re-checks the session anyway.
    }
    const next = `/staff-invite?token=${encodeURIComponent(token)}`;
    window.location.href = `/login?email=${encodeURIComponent(
      inviteEmail,
    )}&next=${encodeURIComponent(next)}`;
  };

  if (matches) {
    return (
      <div className="space-y-3">
        {error ? (
          <p className="text-[13px] font-medium text-status-cancelled">
            {error}
          </p>
        ) : (
          <p className="text-[13px] text-brand-mute">Activating your access…</p>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={accept}
          className="inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
        >
          {pending ? "Activating…" : error ? "Try again" : "Accept invitation"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={switching}
        onClick={switchAccount}
        className="inline-flex w-full items-center justify-center rounded-[10px] bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
      >
        {switching ? "Switching…" : `Continue as ${inviteEmail}`}
      </button>
      <p className="text-[12px] text-brand-mute">
        We&apos;ll sign you out and take you to sign in (or create an account)
        with <strong>{inviteEmail}</strong> — then your access activates
        automatically.
      </p>
    </div>
  );
}
