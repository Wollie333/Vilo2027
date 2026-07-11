"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Plus,
  Trash2,
  MapPin,
  Calendar,
  Users,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormModal, FormModalFooter } from "@/components/ui/form-modal";

import {
  createAlertAction,
  updateAlertAction,
  toggleAlertActiveAction,
  deleteAlertAction,
} from "../actions";

export type AlertRow = {
  id: string;
  name: string | null;
  category: string | null;
  location_region: string | null;
  min_budget: number | null;
  max_budget: number | null;
  min_guests: number | null;
  max_guests: number | null;
  check_in_from: string | null;
  check_in_to: string | null;
  is_active: boolean;
  match_count: number | null;
  last_notified_at: string | null;
  created_at: string;
};

type FormState = {
  name: string;
  category: string; // "" = any
  location_region: string;
  min_budget: string;
  max_budget: string;
  min_guests: string;
  max_guests: string;
  check_in_from: string;
  check_in_to: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  category: "",
  location_region: "",
  min_budget: "",
  max_budget: "",
  min_guests: "",
  max_guests: "",
  check_in_from: "",
  check_in_to: "",
};

function toForm(a: AlertRow): FormState {
  return {
    name: a.name ?? "",
    category: a.category ?? "",
    location_region: a.location_region ?? "",
    min_budget: a.min_budget != null ? String(a.min_budget) : "",
    max_budget: a.max_budget != null ? String(a.max_budget) : "",
    min_guests: a.min_guests != null ? String(a.min_guests) : "",
    max_guests: a.max_guests != null ? String(a.max_guests) : "",
    check_in_from: a.check_in_from ?? "",
    check_in_to: a.check_in_to ?? "",
  };
}

const num = (s: string): number | undefined => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
};

export function AlertsManager({
  hostId,
  initialAlerts,
}: {
  hostId: string;
  initialAlerts: AlertRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AlertRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, start] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState<AlertRow | null>(null);

  const alerts = initialAlerts;

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }
  function openEdit(a: AlertRow) {
    setEditing(a);
    setForm(toForm(a));
    setOpen(true);
  }

  function submit() {
    const payload = {
      name: form.name.trim() || undefined,
      category: form.category || undefined,
      location_region: form.location_region.trim() || undefined,
      min_budget: num(form.min_budget),
      max_budget: num(form.max_budget),
      min_guests: num(form.min_guests),
      max_guests: num(form.max_guests),
      check_in_from: form.check_in_from || undefined,
      check_in_to: form.check_in_to || undefined,
    };
    start(async () => {
      const res = editing
        ? await updateAlertAction(editing.id, payload)
        : await createAlertAction({ hostId, ...payload });
      if (!res.success) {
        toast.error(res.error ?? "Couldn't save the alert.");
        return;
      }
      toast.success(editing ? "Alert updated." : "Alert created.");
      setOpen(false);
      router.refresh();
    });
  }

  function toggle(a: AlertRow) {
    start(async () => {
      const res = await toggleAlertActiveAction(a.id);
      if (!res.success) {
        toast.error(res.error ?? "Couldn't update the alert.");
        return;
      }
      toast.success(res.is_active ? "Alert active." : "Alert paused.");
      router.refresh();
    });
  }

  function remove(a: AlertRow) {
    start(async () => {
      const res = await deleteAlertAction(a.id);
      if (!res.success) {
        toast.error(res.error ?? "Couldn't delete the alert.");
        return;
      }
      toast.success("Alert deleted.");
      setConfirmDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-mute">
          Get notified when new requests match your criteria
        </p>
        <Button size="sm" className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />
          New Alert
        </Button>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-card border border-dashed border-brand-line bg-white p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-light text-brand-mute">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="font-display text-lg font-semibold text-brand-ink">
            No alerts set up
          </h3>
          <p className="mt-2 text-sm text-brand-mute">
            Create an alert to get notified when guest requests match your
            property.
          </p>
          <Button className="mt-4 gap-1.5" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Create Your First Alert
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start justify-between rounded-card border border-brand-line bg-white p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-brand-ink">
                    {alert.name ?? "Unnamed Alert"}
                  </h3>
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      alert.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {alert.is_active ? "Active" : "Paused"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap gap-3 text-sm text-brand-mute">
                  {alert.category && (
                    <span className="flex items-center gap-1">
                      <span className="capitalize">{alert.category}</span>
                    </span>
                  )}
                  {alert.location_region && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {alert.location_region}
                    </span>
                  )}
                  {(alert.min_guests || alert.max_guests) && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {alert.min_guests && alert.max_guests
                        ? `${alert.min_guests}–${alert.max_guests} guests`
                        : alert.min_guests
                          ? `${alert.min_guests}+ guests`
                          : `Up to ${alert.max_guests} guests`}
                    </span>
                  )}
                  {(alert.check_in_from || alert.check_in_to) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {alert.check_in_from && alert.check_in_to
                        ? `${new Date(alert.check_in_from).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })} – ${new Date(alert.check_in_to).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                        : alert.check_in_from
                          ? `From ${new Date(alert.check_in_from).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`
                          : `Until ${new Date(alert.check_in_to!).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-xs text-brand-mute">
                  {alert.match_count ?? 0} matches
                  {alert.last_notified_at && (
                    <span>
                      {" "}
                      · Last notified{" "}
                      {new Date(alert.last_notified_at).toLocaleDateString(
                        "en-ZA",
                      )}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-brand-mute"
                  disabled={pending}
                  onClick={() => toggle(alert)}
                >
                  {alert.is_active ? "Pause" : "Activate"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-brand-mute"
                  disabled={pending}
                  onClick={() => openEdit(alert)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  disabled={pending}
                  onClick={() => setConfirmDelete(alert)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <FormModal
        open={open}
        onOpenChange={setOpen}
        title={editing ? "Edit alert" : "New request alert"}
        description="We'll notify you when a guest request matches these criteria. Leave a field blank to match anything."
        size="lg"
      >
        <div className="grid gap-4">
          <div>
            <Label htmlFor="alert-name">Name (optional)</Label>
            <Input
              id="alert-name"
              value={form.name}
              placeholder="e.g. Karoo weekend getaways"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="alert-category">Category</Label>
              <Select
                value={form.category || "any"}
                onValueChange={(v) =>
                  setForm({ ...form, category: v === "any" ? "" : v })
                }
              >
                <SelectTrigger id="alert-category">
                  <SelectValue placeholder="Any category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any category</SelectItem>
                  <SelectItem value="accommodation">Accommodation</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="alert-region">Region</Label>
              <Input
                id="alert-region"
                value={form.location_region}
                placeholder="e.g. Western Cape"
                onChange={(e) =>
                  setForm({ ...form, location_region: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="alert-min-budget">Min budget (R)</Label>
              <Input
                id="alert-min-budget"
                type="number"
                inputMode="numeric"
                value={form.min_budget}
                onChange={(e) =>
                  setForm({ ...form, min_budget: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="alert-max-budget">Max budget (R)</Label>
              <Input
                id="alert-max-budget"
                type="number"
                inputMode="numeric"
                value={form.max_budget}
                onChange={(e) =>
                  setForm({ ...form, max_budget: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="alert-min-guests">Min guests</Label>
              <Input
                id="alert-min-guests"
                type="number"
                inputMode="numeric"
                value={form.min_guests}
                onChange={(e) =>
                  setForm({ ...form, min_guests: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="alert-max-guests">Max guests</Label>
              <Input
                id="alert-max-guests"
                type="number"
                inputMode="numeric"
                value={form.max_guests}
                onChange={(e) =>
                  setForm({ ...form, max_guests: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="alert-checkin-from">Check-in from</Label>
              <Input
                id="alert-checkin-from"
                type="date"
                value={form.check_in_from}
                onChange={(e) =>
                  setForm({ ...form, check_in_from: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="alert-checkin-to">Check-in to</Label>
              <Input
                id="alert-checkin-to"
                type="date"
                value={form.check_in_to}
                onChange={(e) =>
                  setForm({ ...form, check_in_to: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <FormModalFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create alert"}
          </Button>
        </FormModalFooter>
      </FormModal>

      <FormModal
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete alert?"
        description={
          confirmDelete
            ? `“${confirmDelete.name ?? "This alert"}” will stop notifying you. This can't be undone.`
            : ""
        }
      >
        <FormModalFooter>
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(null)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            className="bg-red-600 hover:bg-red-700"
            onClick={() => confirmDelete && remove(confirmDelete)}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete alert"}
          </Button>
        </FormModalFooter>
      </FormModal>
    </>
  );
}
