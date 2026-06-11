"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  FormModal,
  FormModalCancel,
  FormModalFooter,
} from "@/components/ui/form-modal";
import { modal } from "@/components/ui/modal-host";

import { addGuestContactAction } from "./actions";

export function AddGuestModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setPending(true);
    const res = await addGuestContactAction({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      country: String(fd.get("country") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      email_consent: fd.get("email_consent") === "on",
    });
    setPending(false);

    if (!res.ok) {
      void modal.error({ title: "Couldn't add guest", description: res.error });
      return;
    }
    onOpenChange(false);
    router.push(`/dashboard/guests/${res.data!.gkey}`);
  }

  const input =
    "h-10 w-full rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20";
  const labelCls = "mb-1 block text-[12.5px] font-semibold text-brand-ink";

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add a guest"
      description="Save a contact manually — they'll appear in your guest directory."
    >
      <form id="add-guest-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className={labelCls} htmlFor="ag-name">
            Full name
          </label>
          <input
            id="ag-name"
            name="name"
            className={input}
            required
            autoFocus
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="ag-email">
              Email
            </label>
            <input
              id="ag-email"
              name="email"
              type="email"
              className={input}
              required
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="ag-phone">
              Phone{" "}
              <span className="font-normal text-brand-mute">(optional)</span>
            </label>
            <input id="ag-phone" name="phone" className={input} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="ag-country">
            Country{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </label>
          <input id="ag-country" name="country" className={input} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ag-notes">
            Notes{" "}
            <span className="font-normal text-brand-mute">(optional)</span>
          </label>
          <textarea
            id="ag-notes"
            name="notes"
            rows={3}
            className="w-full rounded-lg border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
          />
        </div>
        <label className="flex items-start gap-2.5 rounded-lg border border-brand-line bg-brand-light/40 p-3">
          <input
            type="checkbox"
            name="email_consent"
            className="mt-0.5 h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
          />
          <span className="text-[12.5px] leading-snug text-brand-mute">
            I have this person&apos;s consent to email them. Required before
            they can receive marketing broadcasts (POPIA).
          </span>
        </label>
      </form>

      <FormModalFooter>
        <FormModalCancel disabled={pending}>Cancel</FormModalCancel>
        <button
          type="submit"
          form="add-guest-form"
          disabled={pending}
          className="rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add guest"}
        </button>
      </FormModalFooter>
    </FormModal>
  );
}
