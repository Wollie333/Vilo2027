"use client";

import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSidebarToggle } from "./SidebarToggle";

export type GmailNavItem = {
  href?: string;
  label: string;
  icon?: LucideIcon;
  /** Small coloured dot instead of an icon (used for per-listing rows). */
  dotColor?: string;
  /** Right-aligned count (e.g. inbox unread). */
  count?: number | string;
  /** Pill badge (PRO / alert). */
  badge?: { text: string; tone?: "pro" | "alert" | "count" };
  match?: "exact" | "prefix";
  onClick?: () => void;
};

export type GmailNavSection = {
  label?: string;
  items: GmailNavItem[];
};

export type GmailNavCompose = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
};

function itemActive(
  pathname: string,
  href?: string,
  match: "exact" | "prefix" = "exact",
) {
  if (!href) return false;
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavRow({
  item,
  collapsed,
}: {
  item: GmailNavItem;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = itemActive(pathname, item.href, item.match);
  const Icon = item.icon;

  const base = collapsed
    ? "mx-auto mt-0.5 flex h-12 w-12 items-center justify-center rounded-full"
    : "mr-2 flex h-[38px] items-center rounded-r-full pl-6 pr-4";
  const tone = active
    ? "bg-brand-accent font-bold text-brand-secondary"
    : "font-medium text-[#3A5A4E] hover:bg-[#E2EDE6]";

  const inner = (
    <>
      <span
        className={`flex w-5 shrink-0 items-center justify-center ${
          collapsed ? "" : "mr-[18px]"
        }`}
      >
        {Icon ? (
          <Icon className="h-[18px] w-[18px]" />
        ) : item.dotColor ? (
          <span
            className="block h-2.5 w-2.5 rounded-full"
            style={{ background: item.dotColor }}
          />
        ) : null}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate text-[14px]">
            {item.label}
          </span>
          {item.badge ? (
            <span
              className={`num ml-2 rounded-pill px-1.5 py-0.5 text-[10px] font-bold ${
                item.badge.tone === "alert"
                  ? "bg-status-cancelled text-white"
                  : item.badge.tone === "pro"
                    ? "bg-brand-accent text-brand-secondary"
                    : "bg-brand-secondary text-white"
              }`}
            >
              {item.badge.text}
            </span>
          ) : item.count !== undefined && item.count !== 0 ? (
            <span
              className={`num ml-2 text-[12px] tabular-nums ${
                active ? "font-bold text-brand-secondary" : "text-[#5B7065]"
              }`}
            >
              {item.count}
            </span>
          ) : null}
        </>
      )}
    </>
  );

  const className = `${base} ${tone} text-[14px] transition-colors`;
  const title = collapsed ? item.label : undefined;

  if (item.href) {
    return (
      <Link
        href={item.href}
        className={className}
        title={title}
        aria-current={active ? "page" : undefined}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={item.onClick}
      className={`${className} w-full text-left`}
      title={title}
    >
      {inner}
    </button>
  );
}

/**
 * Unified Gmail-style sidebar shared by all three portals (host dashboard,
 * guest portal, super admin). Identical chrome everywhere — only the compose
 * button, the `top`/`bottom` slots and the nav `sections` differ per area.
 *
 * Collapses to a 76px icon rail driven by the header hamburger
 * (`useSidebarToggle`), persisted across navigation.
 */
export function GmailNav({
  ariaLabel,
  compose,
  top,
  sections,
  footer,
  bottom,
}: {
  ariaLabel: string;
  compose?: GmailNavCompose;
  /** Workspace switcher / identity — hidden in rail mode. */
  top?: React.ReactNode;
  sections: GmailNavSection[];
  /** Settings / help / sign-out group pinned above the bottom slot. */
  footer?: GmailNavItem[];
  /** Plan card etc. — hidden in rail mode. */
  bottom?: React.ReactNode;
}) {
  const { collapsed } = useSidebarToggle();
  const ComposeIcon = compose?.icon ?? Plus;

  return (
    <aside
      aria-label={ariaLabel}
      className={`hidden shrink-0 flex-col overflow-hidden border-r border-brand-line bg-[#EEF4F0] transition-[width] duration-200 ease-out lg:flex ${
        collapsed ? "w-[76px]" : "w-[248px]"
      }`}
    >
      {compose ? (
        <div
          className={collapsed ? "px-2 pb-3 pt-2.5" : "px-[14px] pb-3 pt-2.5"}
        >
          {compose.href ? (
            <Link
              href={compose.href}
              title={compose.label}
              className={`flex h-12 items-center rounded-card border border-brand-line bg-white font-semibold text-brand-secondary shadow-[0_1px_3px_rgba(6,78,59,.1),0_6px_14px_-6px_rgba(6,78,59,.18)] transition-all hover:bg-[#FAFEFB] hover:shadow-[0_2px_6px_rgba(6,78,59,.16),0_10px_22px_-8px_rgba(6,78,59,.24)] ${
                collapsed ? "w-12 justify-center px-0" : "px-[18px]"
              }`}
            >
              <span className="flex w-5 shrink-0 items-center justify-center text-brand-primary">
                <ComposeIcon className="h-5 w-5" />
              </span>
              {!collapsed && (
                <span className="ml-[14px] whitespace-nowrap text-[14px]">
                  {compose.label}
                </span>
              )}
            </Link>
          ) : (
            <button
              type="button"
              onClick={compose.onClick}
              title={compose.label}
              className={`flex h-12 items-center rounded-card border border-brand-line bg-white font-semibold text-brand-secondary shadow-[0_1px_3px_rgba(6,78,59,.1),0_6px_14px_-6px_rgba(6,78,59,.18)] transition-all hover:bg-[#FAFEFB] hover:shadow-[0_2px_6px_rgba(6,78,59,.16),0_10px_22px_-8px_rgba(6,78,59,.24)] ${
                collapsed ? "w-12 justify-center px-0" : "w-full px-[18px]"
              }`}
            >
              <span className="flex w-5 shrink-0 items-center justify-center text-brand-primary">
                <ComposeIcon className="h-5 w-5" />
              </span>
              {!collapsed && (
                <span className="ml-[14px] whitespace-nowrap text-[14px]">
                  {compose.label}
                </span>
              )}
            </button>
          )}
        </div>
      ) : null}

      {!collapsed && top ? <div className="px-3 pb-2">{top}</div> : null}

      <nav className="flex-1 overflow-y-auto pb-3">
        {sections.map((section, si) => (
          <div key={si}>
            {section.label && !collapsed ? (
              <div className="px-6 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
                {section.label}
              </div>
            ) : section.label && collapsed && si > 0 ? (
              <div className="mx-auto my-2 h-px w-8 bg-[#E1ECE5]" />
            ) : si > 0 && !section.label && collapsed ? (
              <div className="mx-auto my-2 h-px w-8 bg-[#E1ECE5]" />
            ) : si > 0 && !section.label ? (
              <div className="my-2 mr-3 h-px bg-[#E1ECE5]" />
            ) : null}
            {section.items.map((item, ii) => (
              <NavRow
                key={item.href ?? `${si}-${ii}`}
                item={item}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      {footer && footer.length > 0 ? (
        <div className="border-t border-brand-line py-2">
          {footer.map((item, i) => (
            <NavRow
              key={item.href ?? `f-${i}`}
              item={item}
              collapsed={collapsed}
            />
          ))}
        </div>
      ) : null}

      {!collapsed && bottom ? (
        <div className="px-3 pb-4 pt-1">{bottom}</div>
      ) : null}
    </aside>
  );
}
