"use client";

import {
  BarChart3,
  Flag,
  LayoutDashboard,
  Megaphone,
  ScrollText,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

// Inner tab switcher for the admin campaign detail — the admin mirror of the
// partner-facing RaceTabs. Panels are server-rendered and passed in as nodes;
// this only shows the active one, so each panel keeps its real data + client
// bits (the builder form, pause buttons, rules editor).
const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "metrics", label: "Metrics", icon: BarChart3 },
  { key: "standings", label: "Standings", icon: Trophy },
  { key: "results", label: "Results", icon: Flag },
  { key: "partners", label: "Partners", icon: Users },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "rules", label: "Rules & prizes", icon: ScrollText },
];

export function CampaignAdminTabs({
  panels,
}: {
  panels: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState("overview");
  const shown = TABS.filter((t) => panels[t.key]);

  return (
    <>
      <div className="thin-scroll mt-1.5 flex items-center gap-7 overflow-x-auto border-b border-brand-line">
        {shown.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={`tabbtn ${active === t.key ? "on" : ""}`}
            >
              <Icon className="h-[17px] w-[17px]" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-6">
        {shown.map((t) => (
          <div key={t.key} hidden={active !== t.key} className="fade">
            {panels[t.key]}
          </div>
        ))}
      </div>
    </>
  );
}
