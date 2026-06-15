"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteServiceAction, upsertServiceAction } from "./actions";

export type EditorService = {
  id: string | null;
  name: string;
  description: string;
  billingType: "one_time" | "recurring";
  price: number;
  currency: string;
  billingCycle: "monthly" | "annual";
  isActive: boolean;
  sortOrder: number;
};

export function ServiceEditor({
  service,
  isNew,
}: {
  service: EditorService;
  isNew: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<EditorService>(service);
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  function set<K extends keyof EditorService>(k: K, v: EditorService[K]) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function save() {
    if (!f.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    start(async () => {
      try {
        await upsertServiceAction({
          id: f.id,
          name: f.name.trim(),
          description: f.description.trim() || null,
          billingType: f.billingType,
          price: f.price,
          currency: f.currency.trim().toUpperCase() || "ZAR",
          billingCycle: f.billingType === "recurring" ? f.billingCycle : null,
          isActive: f.isActive,
          sortOrder: f.sortOrder,
        });
        toast.success(isNew ? "Service created." : "Service saved.");
        router.push("/admin/subscriptions/services");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save.");
      }
    });
  }

  function remove() {
    if (!f.id) return;
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    startDelete(async () => {
      try {
        await deleteServiceAction({ id: f.id! });
        toast.success("Service deleted.");
        router.push("/admin/subscriptions/services");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete.");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <Field label="Name">
          <Input
            value={f.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Premium support"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Pricing
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Billing">
            <select
              value={f.billingType}
              onChange={(e) =>
                set(
                  "billingType",
                  e.target.value as EditorService["billingType"],
                )
              }
              className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
          </Field>
          {f.billingType === "recurring" ? (
            <Field label="Cycle">
              <select
                value={f.billingCycle}
                onChange={(e) =>
                  set(
                    "billingCycle",
                    e.target.value as EditorService["billingCycle"],
                  )
                }
                className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
            </Field>
          ) : null}
          <Field label="Price">
            <Input
              type="number"
              min={0}
              value={f.price}
              onChange={(e) => set("price", Number(e.target.value) || 0)}
              className="font-mono"
            />
          </Field>
          <Field label="Currency">
            <Input
              value={f.currency}
              maxLength={3}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
              className="font-mono uppercase"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Sort order">
            <Input
              type="number"
              min={0}
              value={f.sortOrder}
              onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              className="w-24 font-mono"
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="rounded border-brand-line"
            />
            Active
          </label>
        </div>
      </section>

      <div className="flex items-center justify-between gap-2">
        <div>
          {!isNew ? (
            <Button
              type="button"
              variant="outline"
              onClick={remove}
              disabled={deleting}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/subscriptions/services")}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : isNew ? "Create service" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
    </label>
  );
}
