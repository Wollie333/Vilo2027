"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { softDeleteListingAction } from "../actions";

export function DangerTab({
  listingId,
  listingName,
}: {
  listingId: string;
  listingName: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();
  const canDelete = confirmText.trim() === listingName.trim();

  function onDelete() {
    if (!canDelete) return;
    start(async () => {
      const result = await softDeleteListingAction(listingId);
      if (result.ok) {
        toast.success("Listing deleted");
        router.push("/dashboard/properties");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-card border-status-cancelled/30 shadow-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-status-cancelled" />
          <CardTitle className="font-display text-xl font-bold text-brand-dark">
            Danger zone
          </CardTitle>
        </div>
        <CardDescription className="text-brand-mute">
          Soft-deleting a listing removes it from search, your host page, and
          unpublishes it. Bookings stay readable for your records and the
          guest&rsquo;s. This can&rsquo;t be undone from the UI today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-card border border-status-cancelled/40 bg-red-50/60 p-4">
          <div className="font-display text-base font-semibold text-brand-ink">
            Delete this listing
          </div>
          <p className="mt-1 text-sm text-brand-mute">
            You can&rsquo;t delete a listing while it has pending, confirmed or
            checked-in bookings. Cancel or complete those first.
          </p>

          <div className="mt-4 space-y-2">
            <label
              htmlFor="confirm-name"
              className="text-xs font-medium text-brand-dark"
            >
              Type{" "}
              <span className="font-mono font-semibold">{listingName}</span> to
              confirm.
            </label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={listingName}
              disabled={pending}
              className="font-mono"
            />
          </div>

          <Button
            type="button"
            onClick={onDelete}
            disabled={!canDelete || pending}
            variant="destructive"
            className="mt-4 gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            {pending ? "Deleting…" : "Delete listing"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
