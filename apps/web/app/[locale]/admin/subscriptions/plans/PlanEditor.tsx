"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deletePlanAction, upsertPlanAction } from "./actions";

export type EditorPlan = {
  key: string;
  name: string;
  tagline: string;
  description: string;
  currency: string;
  trialDays: number;
  isFree: boolean;
  isActive: boolean;
  isRecommended: boolean;
  bullets: string[];
  sortOrder: number;
  monthly: number;
  annual: number;
};

export function PlanEditor({
  plan,
  isNew,
}: {
  plan: EditorPlan;
  isNew: boolean;
}) {
  const router = useRouter();
  const [f, setF] = useState<EditorPlan>(plan);
  const [bulletsText, setBulletsText] = useState(plan.bullets.join("\n"));
  const [pending, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  function set<K extends keyof EditorPlan>(k: K, v: EditorPlan[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    if (!f.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    if (isNew && !/^[a-z0-9_]{2,}$/.test(f.key)) {
      toast.error("Key: lowercase letters, numbers, underscores (min 2).");
      return;
    }
    const bullets = bulletsText
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    start(async () => {
      try {
        await upsertPlanAction({
          key: f.key,
          name: f.name.trim(),
          tagline: f.tagline.trim() || null,
          description: f.description.trim() || null,
          currency: f.currency.trim().toUpperCase() || "ZAR",
          trialDays: f.trialDays,
          isFree: f.isFree,
          isActive: f.isActive,
          isRecommended: f.isRecommended,
          bullets,
          sortOrder: f.sortOrder,
          monthlyPrice: f.isFree ? 0 : f.monthly,
          annualPrice: f.isFree ? 0 : f.annual,
        });
        toast.success(isNew ? "Plan created." : "Plan saved.");
        router.push("/admin/subscriptions/plans");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't save the plan.");
      }
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Delete the "${f.name}" plan? This can't be undone (only allowed if no host is on it).`,
      )
    )
      return;
    startDelete(async () => {
      try {
        await deletePlanAction({ key: f.key });
        toast.success("Plan deleted.");
        router.push("/admin/subscriptions/plans");
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Couldn't delete the plan.",
        );
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Plan key"
            hint={isNew ? "Permanent — can't change later." : "Immutable."}
          >
            <Input
              value={f.key}
              disabled={!isNew}
              onChange={(e) => set("key", e.target.value.toLowerCase())}
              placeholder="enterprise"
              className="font-mono"
            />
          </Field>
          <Field label="Name">
            <Input
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Enterprise"
            />
          </Field>
        </div>
        <Field label="Tagline">
          <Input
            value={f.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="For large operators."
          />
        </Field>
        <Field label="Description (optional)">
          <textarea
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <h2 className="font-display text-sm font-bold text-brand-ink">
          Pricing
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.isFree}
            onChange={(e) => set("isFree", e.target.checked)}
            className="rounded border-brand-line"
          />
          This is a free plan (no charge, no trial)
        </label>
        {!f.isFree ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Currency">
              <Input
                value={f.currency}
                onChange={(e) => set("currency", e.target.value.toUpperCase())}
                maxLength={3}
                className="font-mono uppercase"
              />
            </Field>
            <Field label="Monthly price">
              <Input
                type="number"
                min={0}
                value={f.monthly}
                onChange={(e) => set("monthly", Number(e.target.value) || 0)}
                className="font-mono"
              />
            </Field>
            <Field label="Annual price">
              <Input
                type="number"
                min={0}
                value={f.annual}
                onChange={(e) => set("annual", Number(e.target.value) || 0)}
                className="font-mono"
              />
            </Field>
          </div>
        ) : null}
        <Field label="Trial days" hint="0 = no trial.">
          <Input
            type="number"
            min={0}
            max={365}
            value={f.trialDays}
            onChange={(e) => set("trialDays", Number(e.target.value) || 0)}
            className="w-28 font-mono"
          />
        </Field>
      </section>

      <section className="space-y-4 rounded-card border border-brand-line bg-white p-5 shadow-card">
        <Field label="Selling points (one per line)">
          <textarea
            value={bulletsText}
            onChange={(e) => setBulletsText(e.target.value)}
            rows={5}
            className="block w-full rounded-md border border-brand-line bg-white px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            placeholder={"Unlimited listings\nPriority support\nWhite-label"}
          />
        </Field>
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
              checked={f.isRecommended}
              onChange={(e) => set("isRecommended", e.target.checked)}
              className="rounded border-brand-line"
            />
            Recommended
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={f.isActive}
              onChange={(e) => set("isActive", e.target.checked)}
              className="rounded border-brand-line"
            />
            Active (shown to hosts)
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
              {deleting ? "Deleting…" : "Delete plan"}
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/subscriptions/plans")}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : isNew ? "Create plan" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11.5px] font-semibold uppercase tracking-wider text-brand-mute">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-[11px] text-brand-mute">{hint}</span>
      ) : null}
    </label>
  );
}
