"use client";

import { PanelLeft, PanelLeftClose } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "vilo:sidebar-collapsed";

type SidebarToggleContextValue = {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
};

const SidebarToggleContext = createContext<SidebarToggleContextValue | null>(
  null,
);

/**
 * Shared show/hide state for the logged-in sidebars (host dashboard, guest
 * portal, admin). The preference is persisted to localStorage so it survives
 * navigation and reloads. Wrap each app shell with this provider so the
 * sidebar's collapse button and the floating reveal button share one source
 * of truth.
 */
export function SidebarToggleProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Restore the persisted preference after mount — reading localStorage during
  // render would mismatch the server-rendered HTML (which always starts open).
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // localStorage unavailable (private mode) — keep the open default.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // Persistence is best-effort; ignore failures.
    }
  }, [collapsed]);

  return (
    <SidebarToggleContext.Provider
      value={{ collapsed, toggle: () => setCollapsed((v) => !v), setCollapsed }}
    >
      {children}
    </SidebarToggleContext.Provider>
  );
}

export function useSidebarToggle(): SidebarToggleContextValue {
  const ctx = useContext(SidebarToggleContext);
  // Fallback keeps a sidebar usable if it's ever rendered outside a provider.
  if (!ctx) {
    return { collapsed: false, toggle: () => {}, setCollapsed: () => {} };
  }
  return ctx;
}

/**
 * Collapse control that lives in the sidebar header, beside the brand/main
 * menu. Desktop-only — on mobile the sidebar is already hidden behind the
 * bottom nav.
 */
export function SidebarToggleButton() {
  const { toggle } = useSidebarToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Hide sidebar"
      title="Hide sidebar"
      className="ml-auto hidden h-8 w-8 items-center justify-center rounded-md text-brand-mute transition-colors hover:bg-brand-accent/60 hover:text-brand-ink lg:flex"
    >
      <PanelLeftClose className="h-4 w-4" />
    </button>
  );
}

/**
 * Floating control rendered by the app shell. It only appears once the sidebar
 * is hidden, giving the user a way to bring it back.
 */
export function SidebarRevealButton() {
  const { collapsed, toggle } = useSidebarToggle();
  if (!collapsed) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Show sidebar"
      title="Show sidebar"
      className="fixed left-3 top-3 z-40 hidden h-9 w-9 items-center justify-center rounded-md border border-brand-line bg-white text-brand-mute shadow-sm transition-colors hover:bg-brand-accent/60 hover:text-brand-ink lg:flex"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}
