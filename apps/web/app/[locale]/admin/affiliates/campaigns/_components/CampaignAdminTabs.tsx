"use client";

import {
  BarChart3,
  Flag,
  LayoutDashboard,
  Mail,
  Megaphone,
  ScrollText,
  SlidersHorizontal,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

// Inner tab switcher for the admin campaign detail — the admin mirror of the
// partner-facing RaceTabs. Panels are server-rendered and passed in as nodes;
// this only shows the active one, so each panel keeps its real data + client
// bits (the builder form, pause buttons, rules binder).
//
// The active tab is mirrored to the URL hash (#setup, #rules…) so the Overview
// dashboard can deep-link straight into Setup with a plain anchor, and a
// refresh/return keeps you where you were.
const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "setup", label: "Setup", icon: SlidersHorizontal },
  { key: "metrics", label: "Metrics", icon: BarChart3 },
  { key: "standings", label: "Standings", icon: Trophy },
  { key: "results", label: "Results", icon: Flag },
  { key: "partners", label: "Partners", icon: Users },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "rules", label: "Rules", icon: ScrollText },
];

export function CampaignAdminTabs({
  panels,
}: {
  panels: Record<string, React.ReactNode>;
}) {
  const shown = TABS.filter((t) => panels[t.key]);
  const [active, setActive] = useState("overview");

  // Read the initial tab from the hash, and follow later hash changes (the
  // dashboard's "Open setup" anchor, browser back/forward).
  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && shown.some((t) => t.key === h)) setActive(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
    // shown is derived from stable panels keys; run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(key: string) {
    setActive(key);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${key}`);
    }
  }

  return (
    <>
      <div className="thin-scroll mt-1.5 flex items-center gap-7 overflow-x-auto border-b border-brand-line">
        {shown.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => select(t.key)}
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
