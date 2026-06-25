"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { SiteMenuItem } from "@/lib/site/types";

/**
 * Mobile / tablet navigation: a hamburger button that opens a themed slide-in
 * drawer. Top-level items with children expand inline (accordion) — touch-
 * friendly, unlike the desktop hover dropdowns. Themed entirely off `--site-*`
 * so it matches every theme. Closes on link tap, backdrop, the X, or Escape.
 */
export function SiteMobileMenu({
  menu,
  bookHref,
  bookLabel,
  dark,
  className = "",
}: {
  menu: SiteMenuItem[];
  bookHref?: string;
  bookLabel?: string;
  dark?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (menu.length === 0 && !bookHref) return null;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        style={{ color: dark ? "#fff" : "var(--site-ink)" }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--site-radius)] transition-opacity hover:opacity-80"
      >
        <Menu className="h-6 w-6" />
      </button>

      {open ? (
        <>
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] bg-black/40"
          />
          {/* Drawer */}
          <div
            role="dialog"
            aria-modal="true"
            style={{ background: "var(--site-bg)", color: "var(--site-ink)" }}
            className="fixed inset-y-0 right-0 z-[61] flex w-[86%] max-w-sm flex-col shadow-2xl"
          >
            <div
              style={{ borderColor: "var(--site-line)" }}
              className="flex items-center justify-between border-b px-5 py-4"
            >
              <span
                style={{
                  fontFamily: "var(--site-font-heading)",
                  color: "var(--site-ink)",
                }}
                className="text-sm font-semibold uppercase tracking-wide"
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{ color: "var(--site-ink)" }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--site-radius)] transition-opacity hover:opacity-70"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3">
              {menu.map((item) => {
                const hasChildren = !!item.children && item.children.length > 0;
                if (!hasChildren) {
                  return (
                    <a
                      key={item.id}
                      href={item.href}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noopener noreferrer" : undefined}
                      onClick={() => setOpen(false)}
                      style={{ color: "var(--site-ink)" }}
                      className="block rounded-[var(--site-radius)] px-3 py-3 text-base font-medium transition-colors hover:bg-[var(--site-surface)]"
                    >
                      {item.label}
                    </a>
                  );
                }
                const isOpen = expanded[item.id] ?? false;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [item.id]: !isOpen }))
                      }
                      aria-expanded={isOpen}
                      style={{ color: "var(--site-ink)" }}
                      className="flex w-full items-center justify-between rounded-[var(--site-radius)] px-3 py-3 text-base font-medium transition-colors hover:bg-[var(--site-surface)]"
                    >
                      {item.label}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen ? (
                      <div
                        className="mb-1 ml-3 flex flex-col gap-0.5 border-l pl-3"
                        style={{ borderColor: "var(--site-line)" }}
                      >
                        {item.children!.map((child) =>
                          child.children && child.children.length > 0 ? (
                            <div key={child.id} className="py-1">
                              <div
                                style={{ color: "var(--site-mute)" }}
                                className="px-3 pb-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-70"
                              >
                                {child.label}
                              </div>
                              {child.children.map((g) => (
                                <a
                                  key={g.id}
                                  href={g.href}
                                  target={g.newTab ? "_blank" : undefined}
                                  rel={
                                    g.newTab ? "noopener noreferrer" : undefined
                                  }
                                  onClick={() => setOpen(false)}
                                  style={{ color: "var(--site-mute)" }}
                                  className="block rounded-[var(--site-radius)] px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-[var(--site-surface)]"
                                >
                                  {g.label}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <a
                              key={child.id}
                              href={child.href}
                              target={child.newTab ? "_blank" : undefined}
                              rel={
                                child.newTab ? "noopener noreferrer" : undefined
                              }
                              onClick={() => setOpen(false)}
                              style={{ color: "var(--site-mute)" }}
                              className="block rounded-[var(--site-radius)] px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-[var(--site-surface)]"
                            >
                              {child.label}
                            </a>
                          ),
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </nav>

            {bookHref ? (
              <div
                style={{ borderColor: "var(--site-line)" }}
                className="border-t px-5 py-4"
              >
                <a
                  href={bookHref}
                  data-vilo-book
                  onClick={() => setOpen(false)}
                  style={{
                    background: "var(--site-btn-primary-bg)",
                    color: "var(--site-btn-primary-color)",
                    border: "var(--site-btn-primary-border)",
                    borderRadius: "var(--site-btn-primary-radius)",
                  }}
                  className="block w-full px-4 py-3 text-center text-sm font-semibold transition-opacity hover:opacity-90"
                >
                  {bookLabel || "Book now"}
                </a>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
