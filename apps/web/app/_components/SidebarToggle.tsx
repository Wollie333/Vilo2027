"use client";

import { Menu } from "lucide-react";
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
 * Hamburger that lives at the far left of the unified app header. Toggles the
 * sidebar between its full width and the 76px icon rail. Desktop-only — mobile
 * uses the bottom nav, so there is no rail to collapse there.
 */
export function HeaderMenuToggle() {
  const { toggle } = useSidebarToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle sidebar"
      title="Menu"
      className="hidden h-9 w-9 items-center justify-center rounded-full text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink lg:inline-flex"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}
