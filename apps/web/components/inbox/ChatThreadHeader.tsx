"use client";

import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

import { InboxAvatar } from "./InboxAvatar";

// Canonical thread header — avatar + name + subtitle, with a mobile back affordance
// and an optional right-hand action slot (the host uses it for details/archive/pin).
// Shared by the host inbox and the guest portal.
export function ChatThreadHeader({
  name,
  subtitle,
  avatarUrl = null,
  tintClass,
  backHref,
  onBack,
  backAlwaysVisible = false,
  rightSlot,
}: {
  name: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  tintClass?: string;
  backHref?: string;
  onBack?: () => void;
  backAlwaysVisible?: boolean;
  rightSlot?: React.ReactNode;
}) {
  const backClass = `-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-brand-mute hover:bg-brand-light hover:text-brand-ink ${
    backAlwaysVisible ? "" : "lg:hidden"
  }`;

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-brand-line bg-white px-4 py-3">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back to messages"
          className={backClass}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
      ) : onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to messages"
          className={backClass}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}
      <InboxAvatar
        name={name}
        imageUrl={avatarUrl}
        size={40}
        tintClass={tintClass ?? "bg-brand-secondary text-white"}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-[15px] font-bold text-brand-ink">
          {name}
        </div>
        {subtitle ? (
          <div className="truncate text-[12px] text-brand-mute">{subtitle}</div>
        ) : null}
      </div>
      {rightSlot ? (
        <div className="flex shrink-0 items-center gap-1">{rightSlot}</div>
      ) : null}
    </div>
  );
}
