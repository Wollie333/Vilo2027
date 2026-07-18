"use client";

import {
  Briefcase,
  Eye,
  EyeOff,
  FileText,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { setHostAccess, setHostDirectoryVisibility } from "./actions";

// Host access + visibility controls, rendered as a compact row of icon toggles
// in the user-record header (same icon-button style as the admin Control Centre).
// Each toggle flips one switch and shows a red tint while the RESTRICTIVE state is
// on, so an admin reads a host's restrictions at a glance. All calls are audited
// (setHostAccessAction / setHostDirectoryVisibilityAction).
export function HostAccessControls({
  userId,
  accountKind,
  quoteAccess,
  platformAccess,
  hiddenFromDirectory,
}: {
  userId: string;
  accountKind: string;
  quoteAccess: boolean;
  platformAccess: boolean;
  hiddenFromDirectory: boolean;
}) {
  const [pending, start] = useTransition();

  function apply(
    patch: Partial<{
      accountKind: "host" | "quote_only";
      quoteAccess: boolean;
      platformAccess: boolean;
    }>,
    okMsg: string,
  ) {
    start(async () => {
      const r = await setHostAccess({ userId, ...patch });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(okMsg);
    });
  }

  function toggleDirectory(hidden: boolean) {
    start(async () => {
      const r = await setHostDirectoryVisibility({ userId, hidden });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(
        hidden
          ? "Host hidden from the public directory."
          : "Host restored to the public directory.",
      );
    });
  }

  const isQuoteOnly = accountKind === "quote_only";

  return (
    <div>
      <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-brand-mute">
        Access & visibility
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <IconToggle
          icon={isQuoteOnly ? FileText : Briefcase}
          active={isQuoteOnly}
          disabled={pending}
          title={
            isQuoteOnly
              ? "Quote-only account — click to make a full host"
              : "Full host account — click to make quote-only"
          }
          onClick={() =>
            apply(
              { accountKind: isQuoteOnly ? "host" : "quote_only" },
              isQuoteOnly ? "Set to full host." : "Set to quote-only.",
            )
          }
        />
        <IconToggle
          icon={MessageSquareText}
          active={!quoteAccess}
          disabled={pending}
          title={
            quoteAccess
              ? "Quote sending allowed — click to block"
              : "Quote sending blocked — click to allow"
          }
          onClick={() =>
            apply(
              { quoteAccess: !quoteAccess },
              quoteAccess
                ? "Quote sending blocked."
                : "Quote sending restored.",
            )
          }
        />
        <IconToggle
          icon={platformAccess ? LayoutDashboard : Lock}
          active={!platformAccess}
          disabled={pending}
          title={
            platformAccess
              ? "Full platform access — click to restrict to the quotes-only shell"
              : "Restricted to the quotes-only shell — click to restore full access"
          }
          onClick={() =>
            apply(
              { platformAccess: !platformAccess },
              platformAccess
                ? "Bounced to the quotes-only shell."
                : "Full platform access restored.",
            )
          }
        />
        <IconToggle
          icon={hiddenFromDirectory ? EyeOff : Eye}
          active={hiddenFromDirectory}
          disabled={pending}
          title={
            hiddenFromDirectory
              ? "Hidden from the public directory — click to show"
              : "Visible to the public — click to hide all listings & specials"
          }
          onClick={() => toggleDirectory(!hiddenFromDirectory)}
        />
      </div>
    </div>
  );
}

function IconToggle({
  icon: Icon,
  active,
  title,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  active: boolean;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] border shadow-card transition disabled:opacity-50 ${
        active
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border-brand-line bg-white text-brand-secondary hover:border-[#CDE6D8] hover:bg-[#FAFCFB] hover:text-brand-primary"
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}
