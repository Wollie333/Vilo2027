"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccountAction } from "./actions";

// Hard self-delete UI. The action either redirects on success or returns
// a structured error — there is no "ok: true" return path because the
// redirect throws to terminate execution.

export function DeleteAccountSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, start] = useTransition();

  function onDelete() {
    if (confirmation.trim().toLowerCase() !== email.toLowerCase()) {
      toast.error("Email doesn't match — type it exactly to confirm.");
      return;
    }
    start(async () => {
      const result = await deleteAccountAction({
        confirmation: confirmation.trim(),
      });
      // If we got here the redirect didn't fire, which means the action
      // returned an error. (Successful path throws via redirect().)
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="rounded-card border border-red-300 bg-red-50/40 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-100 text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-base font-bold text-red-900">
            Delete account permanently
          </h2>
          <p className="mt-1 text-sm text-red-900/80">
            This wipes your profile, listings, host page, bookings as guest,
            messages, notifications and any reviews you&rsquo;ve left.{" "}
            <span className="font-semibold">There is no undo.</span> Use the
            data-export request above first if you want a copy of your data.
          </p>

          {!open ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(true)}
              className="mt-3 border-red-300 text-red-900 hover:border-red-500 hover:bg-red-100"
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete my account
            </Button>
          ) : (
            <div className="mt-4 space-y-3 rounded-card border border-red-200 bg-white p-4">
              <Label
                htmlFor="delete_confirm"
                className="text-xs font-semibold text-red-900"
              >
                Type your email to confirm
              </Label>
              <Input
                id="delete_confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={email}
                autoComplete="off"
                autoFocus
                spellCheck={false}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setConfirmation("");
                  }}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={
                    pending ||
                    confirmation.trim().toLowerCase() !== email.toLowerCase()
                  }
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {pending ? "Deleting…" : "Delete everything"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
