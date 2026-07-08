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
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function run(
    fn: () => Promise<{ ok: true } | { ok: false; error: string }>,
    ok: string,
  ) {
    setOpen(false);
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
    <div
      ref={ref}
      className="relative inline-flex items-center justify-end gap-1"
    >
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
        type="button"
        aria-label="Listing actions"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-brand-line bg-white text-brand-mute hover:bg-brand-light hover:text-brand-ink disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-9 z-20 w-52 overflow-hidden rounded-card border border-brand-line bg-white py-1 shadow-lg">
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
                  setListingFeatured({ listingId, isFeatured: !isFeatured }),
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
                  () => setListingPublished({ listingId, isPublished: false }),
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
                  () => setListingPublished({ listingId, isPublished: true }),
                  "Listing published",
                )
              }
            >
              Publish
            </MenuItem>
          )}
        </div>
      ) : null}
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
