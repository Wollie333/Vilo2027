"use client";

import { Store, Users } from "lucide-react";
import { useState, type ReactNode } from "react";

// Client toggle switching the Feature-permissions page between HOST plan
// permissions and the global GUEST permission catalog. Both views are rendered
// server-side and passed in; this only flips which is visible.
export function AudienceTabs({
  host,
  guest,
}: {
  host: ReactNode;
  guest: ReactNode;
}) {
  const [tab, setTab] = useState<"host" | "guest">("host");

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Audience"
        className="inline-flex rounded-pill border border-brand-line bg-white p-0.5"
      >
        <Tab
          active={tab === "host"}
          onClick={() => setTab("host")}
          icon={<Store className="h-4 w-4" />}
          label="Hosts"
        />
        <Tab
          active={tab === "guest"}
          onClick={() => setTab("guest")}
          icon={<Users className="h-4 w-4" />}
          label="Guests"
        />
      </div>

      <div>{tab === "host" ? host : guest}</div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "bg-brand-primary text-white shadow-sm"
          : "text-brand-mute hover:text-brand-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
