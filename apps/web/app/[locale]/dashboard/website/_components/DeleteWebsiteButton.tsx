"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { modal } from "@/components/ui/modal-host";
import { useRouter } from "next/navigation";

import { resetWebsiteForTestingAction } from "../actions";

// TEST/RESET — a prominent delete affordance on the website card so the site can
// be hard-deleted and the setup wizard re-run from scratch without going into
// the editor's Settings → Danger Zone. Intended for testing/refinement.
export function DeleteWebsiteButton({
  websiteId,
  siteName,
}: {
  websiteId: string;
  siteName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const ok = await modal.destructive({
        title: "Delete this website & start over?",
        description: `This permanently deletes "${siteName}" and everything in it (pages, forms, media, settings), freeing the business so you can run the setup wizard again from scratch. This cannot be undone. Intended for testing.`,
        confirmLabel: "Delete & start over",
      });
      if (!ok) return;
      const res = await resetWebsiteForTestingAction(websiteId);
      if (!res.ok) {
        toast.error("Couldn't delete the site — please try again.");
        return;
      }
      toast.success("Site deleted — you can run the wizard again.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      title="Delete website & start over (testing)"
      aria-label="Delete website and start over"
      className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
