"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  /** Render the label as a click-to-expand header (needs a label). */
  collapsible?: boolean;
  /** Initial open state for a collapsible section. Defaults to open if the
   *  section contains the active route, else collapsed. */
  defaultOpen?: boolean;
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
 * One nav section. Reproduces the original label/divider behaviour; when
 * `section.collapsible` (and not in rail mode) the label becomes a click-to-
 * expand header so long groups can be tucked away.
 */
function NavSection({
  section,
  index,
  railCollapsed,
}: {
  section: GmailNavSection;
  index: number;
  railCollapsed: boolean;
}) {
  const pathname = usePathname();
  const hasActive = section.items.some((it) =>
    itemActive(pathname, it.href, it.match),
  );
  const canCollapse =
    !!section.collapsible && !!section.label && !railCollapsed;
  const [open, setOpen] = useState(section.defaultOpen ?? hasActive);
  const showItems = !canCollapse || open;

  let header: React.ReactNode = null;
  if (section.label && !railCollapsed) {
    header = canCollapse ? (
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute transition-colors hover:text-brand-ink"
      >
        <span>{section.label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
    ) : (
      <div className="px-6 pb-1 pt-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-brand-mute">
        {section.label}
      </div>
    );
  } else if (section.label && railCollapsed && index > 0) {
    header = <div className="mx-auto my-2 h-px w-8 bg-[#E1ECE5]" />;
  } else if (index > 0 && !section.label && railCollapsed) {
    header = <div className="mx-auto my-2 h-px w-8 bg-[#E1ECE5]" />;
  } else if (index > 0 && !section.label) {
    header = <div className="my-2 mr-3 h-px bg-[#E1ECE5]" />;
  }

  return (
    <div>
      {header}
      {showItems
        ? section.items.map((item, ii) => (
            <NavRow
              key={item.href ?? `${index}-${ii}`}
              item={item}
              collapsed={railCollapsed}
            />
          ))
        : null}
    </div>
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

      <nav className="thin-scroll flex-1 overflow-y-auto pb-3">
        {sections.map((section, si) => (
          <NavSection
            key={si}
            section={section}
            index={si}
            railCollapsed={collapsed}
          />
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
