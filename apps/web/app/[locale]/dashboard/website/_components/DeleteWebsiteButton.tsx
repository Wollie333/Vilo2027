"use client";

import { Trash2, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

import { resetWebsiteForTestingAction } from "../actions";

// TEST/RESET — a prominent, PRIMARY delete affordance on the website card so the
// whole site can be hard-deleted and the setup wizard re-run from scratch without
// going into the editor's Settings → Danger Zone. Intended for testing/refinement
// (remove before launch). Uses a self-contained two-step inline confirm — NO
// external modal dependency — so it always fires even if the modal host isn't
// mounted on this surface.
export function DeleteWebsiteButton({
  websiteId,
  siteName,
}: {
  websiteId: string;
  siteName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function doDelete() {
    startTransition(async () => {
      const res = await resetWebsiteForTestingAction(websiteId);
      if (!res.ok) {
        toast.error("Couldn't delete the site — please try again.");
        setConfirming(false);
        return;
      }
      toast.success("Site deleted — you can run the wizard again.");
      setConfirming(false);
      router.refresh();
    });
  }

  // Two-step: first click arms the confirm, second click deletes. A cancel (X)
  // disarms. Keeps a destructive action from firing on a single stray click,
  // without needing a modal.
  if (confirming) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={doDelete}
          disabled={pending}
          title={`Permanently delete "${siteName}" and everything in it`}
          aria-label="Confirm delete website"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-600 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          {pending ? "Deleting…" : "Confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          title="Cancel"
          aria-label="Cancel delete"
          className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-[10px] border border-brand-line text-brand-mute transition-colors hover:bg-brand-light disabled:opacity-60"
        >
          <X className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={pending}
      title="Delete this website & start over (testing)"
      aria-label="Delete website and start over"
      className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-600 px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
      Delete website
    </button>
  );
}
