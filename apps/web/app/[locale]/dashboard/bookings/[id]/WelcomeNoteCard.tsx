"use client";

import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateBookingHostMessageAction } from "../actions";

export function WelcomeNoteCard({
  bookingId,
  initial,
  guestFirstName,
}: {
  bookingId: string;
  initial: string | null;
  guestFirstName: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const dirty = value.trim() !== (initial ?? "").trim();

  function save() {
    if (pending || !dirty) return;
    start(async () => {
      const result = await updateBookingHostMessageAction(bookingId, value);
      if (result.ok) {
        toast.success("Welcome note saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="p-4">
      <p className="text-[12.5px] leading-relaxed text-brand-mute">
        A warm, personal note shown to{" "}
        {guestFirstName ? (
          <span className="font-medium text-brand-ink">{guestFirstName}</span>
        ) : (
          "your guest"
        )}{" "}
        on their trip page. Guest-facing — keep private reminders in internal
        notes.
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 2000))}
        rows={5}
        placeholder={`Hi ${guestFirstName ?? "there"} — we're so glad you're coming to stay…`}
        className="mt-3 w-full resize-y rounded-[10px] border border-brand-line px-3 py-2 text-[13px] leading-relaxed text-brand-ink placeholder:text-brand-mute focus:border-brand-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/10 disabled:opacity-60"
        disabled={pending}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10.5px] text-brand-mute">
          {value.length}/2000
        </span>
        <button
          type="button"
          onClick={save}
          disabled={pending || !dirty}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-3 py-2 text-[12.5px] font-semibold text-white transition hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {pending ? "Saving…" : "Save note"}
        </button>
      </div>
    </div>
  );
}
