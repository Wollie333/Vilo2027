"use client";

import { Copy, ExternalLink, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  duplicateListingAction,
  softDeleteListingAction,
} from "./[id]/edit/actions";

/**
 * The listing card's ⋯ action menu — Edit, View live (published only),
 * Duplicate → save as draft, and Delete (soft-delete, confirmed). Sits on a
 * Server-Component card, so all mutating work goes through the existing
 * owner-scoped Server Actions. Never hard-deletes a listing (AGENT_RULES §2.1).
 */
export function ListingCardMenu({
  listingId,
  listingName,
  slug,
  isPublished,
}: {
  listingId: string;
  listingName: string;
  slug: string | null;
  isPublished: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, start] = useTransition();

  function onDuplicate() {
    start(async () => {
      const res = await duplicateListingAction(listingId);
      if (res.ok) {
        toast.success(`Duplicated as draft — “${res.data?.name}”`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete() {
    start(async () => {
      const res = await softDeleteListingAction(listingId);
      if (res.ok) {
        toast.success("Listing deleted");
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Listing actions"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-brand-ink shadow-sm backdrop-blur transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/properties/${listingId}/edit`}>
              <Pencil className="mr-2 h-4 w-4 text-brand-mute" />
              Edit
            </Link>
          </DropdownMenuItem>
          {isPublished && slug ? (
            <DropdownMenuItem asChild>
              <Link href={`/property/${slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4 text-brand-mute" />
                View live
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={onDuplicate} disabled={pending}>
            <Copy className="mr-2 h-4 w-4 text-brand-mute" />
            Duplicate as draft
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-status-cancelled focus:text-status-cancelled"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Delete listing?</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-brand-ink">
                {listingName}
              </span>{" "}
              will be removed from search, your host page, and any website — and
              unpublished. Bookings stay readable for your records. You
              can&rsquo;t delete a listing with active bookings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              {pending ? "Deleting…" : "Delete listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
