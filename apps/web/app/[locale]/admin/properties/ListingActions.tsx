"use client";

import {
  EyeOff,
  Eye,
  Loader2,
  MoreHorizontal,
  Star,
  StarOff,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { setListingFeatured, setListingPublished } from "./actions";

export function ListingActions({
  listingId,
  slug,
  isPublished,
  isFeatured,
  name,
}: {
  listingId: string;
  slug: string | null;
  isPublished: boolean;
  isFeatured: boolean;
  name: string;
}) {
  const router = useRouter();
  // The menu is portalled to <body> and fixed-positioned so the table's scroll
  // wrapper / row stacking contexts can't clip or cover it (was a low-z-index
  // absolute menu that vanished behind the table). We anchor it to the button.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const open = menu !== null;
  const [pending, start] = useTransition();
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(ev: React.MouseEvent) {
    ev.stopPropagation();
    if (open) {
      setMenu(null);
      return;
    }
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: rect.right, y: rect.bottom });
  }

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    ok: string,
  ) {
    setMenu(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="inline-flex items-center justify-end gap-1">
      {slug ? (
        <a
          href={`/property/${slug}`}
          target="_blank"
          rel="noreferrer"
          title="View public page"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      <button
        ref={btnRef}
        type="button"
        aria-label="Listing actions"
        onClick={toggle}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>

      {menu
        ? createPortal(
            <div
              className="fixed z-[60] w-52 overflow-hidden rounded-card border border-brand-line bg-white py-1 shadow-lift"
              style={{ top: menu.y + 6, left: Math.max(8, menu.x - 208) }}
              onClick={(ev) => ev.stopPropagation()}
            >
              <MenuItem
                icon={
                  isFeatured ? (
                    <StarOff className="h-4 w-4" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )
                }
                onClick={() =>
                  run(
                    () =>
                      setListingFeatured({
                        listingId,
                        isFeatured: !isFeatured,
                      }),
                    isFeatured ? "Unfeatured" : "Featured",
                  )
                }
              >
                {isFeatured ? "Unfeature" : "Feature"}
              </MenuItem>
              {isPublished ? (
                <MenuItem
                  tone="danger"
                  icon={<EyeOff className="h-4 w-4" />}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Take "${name}" offline? It will be removed from public search and its page until re-published.`,
                      )
                    )
                      return;
                    run(
                      () =>
                        setListingPublished({ listingId, isPublished: false }),
                      "Listing taken offline",
                    );
                  }}
                >
                  Take offline
                </MenuItem>
              ) : (
                <MenuItem
                  icon={<Eye className="h-4 w-4" />}
                  onClick={() =>
                    run(
                      () =>
                        setListingPublished({ listingId, isPublished: true }),
                      "Listing published",
                    )
                  }
                >
                  Publish
                </MenuItem>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-brand-light ${
        tone === "danger" ? "text-red-600" : "text-brand-ink"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
