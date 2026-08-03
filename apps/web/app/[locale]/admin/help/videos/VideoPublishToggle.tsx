"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setHelpVideoStatus } from "./actions";

// Quick publish/unpublish from the video grid — archived videos aren't toggled
// here (use the editor), only draft <-> published.
export function VideoPublishToggle({
  id,
  status,
}: {
  id: string;
  status: "draft" | "published" | "archived";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState(false);

  if (status === "archived") {
    return (
      <span className="text-[11px] font-medium text-brand-mute">Archived</span>
    );
  }

  const published = status === "published";

  function toggle() {
    setErr(false);
    startTransition(async () => {
      const res = await setHelpVideoStatus(
        id,
        published ? "draft" : "published",
      );
      if (!res.ok) setErr(true);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={
        published
          ? "Published — click to unpublish"
          : "Draft — click to publish"
      }
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
        published
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
      }`}
    >
      {published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      {err ? "Failed" : published ? "Published" : "Draft"}
    </button>
  );
}
