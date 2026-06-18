"use client";

import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import {
  SPECIAL_CATEGORIES,
  type SpecialCategoryKey,
} from "@/lib/specials/categories";

import { createSpecialAction, updateSpecialAction } from "../actions";
import type { SpecialEditorData } from "../_lib/load";
import type { SpecialEditorStatus, SpecialInput } from "../schemas";
import {
  DateField,
  Field,
  HeroImageField,
  NumberField,
  SegmentField,
  SelectField,
  TagInput,
  TextArea,
  TextField,
  ToggleField,
} from "./fields";

export function SpecialEditor({
  mode,
  specialId,
  initialValues,
  initialStatus,
  data,
}: {
  mode: "create" | "edit";
  specialId?: string;
  initialValues: SpecialInput;
  initialStatus: SpecialInput["status"];
  data: SpecialEditorData;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SpecialInput>(initialValues);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof SpecialInput>(key: K, value: SpecialInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedProperty = useMemo(
    () => data.properties.find((p) => p.id === form.property_id) ?? null,
    [data.properties, form.property_id],
  );
  const currency = selectedProperty?.currency ?? "ZAR";
  const websiteId = selectedProperty
    ? data.websiteByBusiness[selectedProperty.businessId]
    : undefined;

  function onPickProperty(propertyId: string) {
    const prop = data.properties.find((p) => p.id === propertyId) ?? null;
    setForm((f) => {
      const roomStillValid =
        f.room_id != null && !!prop?.rooms.some((r) => r.id === f.room_id);
      return {
        ...f,
        property_id: propertyId,
        room_id: roomStillValid ? f.room_id : null,
      };
    });
  }

  function toggleCategory(key: SpecialCategoryKey) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(key)
        ? f.categories.filter((c) => c !== key)
        : [...f.categories, key],
    }));
  }

  function toggleAddon(addonId: string) {
    setForm((f) => {
      const exists = f.addons.some((a) => a.addon_id === addonId);
      return {
        ...f,
        addons: exists
          ? f.addons.filter((a) => a.addon_id !== addonId)
          : [
              ...f.addons,
              {
                addon_id: addonId,
                is_required: false,
                unit_price_override: null,
              },
            ],
      };
    });
  }

  function patchAddon(
    addonId: string,
    patch: Partial<SpecialInput["addons"][number]>,
  ) {
    setForm((f) => ({
      ...f,
      addons: f.addons.map((a) =>
        a.addon_id === addonId ? { ...a, ...patch } : a,
      ),
    }));
  }

  function submit(status: SpecialEditorStatus) {
    if (!form.property_id) {
      toast.error("Pick a property first.");
      return;
    }
    const payload: SpecialInput = { ...form, status };
    startTransition(async () => {
      const res =
        mode === "create"
          ? await createSpecialAction(payload)
          : await updateSpecialAction(specialId as string, payload);
      if (res.ok) {
        toast.success(mode === "create" ? "Special created" : "Changes saved");
        router.push("/dashboard/specials");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const linkOnly = !form.show_in_directory && !form.show_on_website;
  const propertyOptions = [
    { value: "", label: "Select a property…" },
    ...data.properties.map((p) => ({ value: p.id, label: p.name })),
  ];
  const roomOptions = [
    { value: "", label: "Whole property" },
    ...(selectedProperty?.rooms ?? []).map((r) => ({
      value: r.id,
      label: r.name,
    })),
  ];
  const policyOptions = [
    { value: "", label: "Inherit the property / room policy" },
    ...data.policies.map((p) => ({ value: p.id, label: p.name })),
  ];

  if (data.properties.length === 0) {
    return <EmptyProperties />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard/specials"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-mute transition-colors hover:text-brand-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to specials
        </Link>
        <span className="rounded-pill bg-brand-light px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-mute">
          {mode === "create" ? "New special" : `Editing · ${initialStatus}`}
        </span>
      </div>

      {/* Target ------------------------------------------------------ */}
      <Section title="Property" subtitle="Which stay this deal sells.">
        <SelectField
          label="Property"
          value={form.property_id || ""}
          options={propertyOptions}
          onChange={onPickProperty}
        />
        <SelectField
          label="Room"
          value={form.room_id ?? ""}
          options={roomOptions}
          onChange={(v) => set("room_id", v || null)}
          hint="Whole property, or limit the deal to one room type."
        />
      </Section>

      {/* Dates ------------------------------------------------------- */}
      <Section title="Dates" subtitle="Fixed stay, or a flexible window.">
        <SegmentField
          label="Date treatment"
          value={form.date_mode}
          onChange={(v) => set("date_mode", v)}
          options={[
            { value: "fixed", label: "Fixed dates", hint: "One exact stay" },
            {
              value: "flexible",
              label: "Flexible window",
              hint: "Guest picks within a window",
            },
          ]}
        />
        {form.date_mode === "fixed" ? (
          <div className="grid grid-cols-2 gap-3">
            <DateField
              label="Check-in"
              value={form.fixed_check_in}
              onChange={(v) => set("fixed_check_in", v)}
            />
            <DateField
              label="Check-out"
              value={form.fixed_check_out}
              min={form.fixed_check_in ?? undefined}
              onChange={(v) => set("fixed_check_out", v)}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Window opens"
                value={form.window_start}
                onChange={(v) => set("window_start", v)}
              />
              <DateField
                label="Window closes"
                value={form.window_end}
                min={form.window_start ?? undefined}
                onChange={(v) => set("window_end", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Min nights"
                value={form.min_nights}
                min={1}
                max={365}
                onChange={(v) => set("min_nights", v)}
              />
              <NumberField
                label="Max nights"
                value={form.max_nights}
                min={1}
                max={365}
                onChange={(v) => set("max_nights", v)}
                hint="Leave blank for no maximum."
              />
            </div>
          </>
        )}
      </Section>

      {/* Pricing ----------------------------------------------------- */}
      <Section
        title="Price"
        subtitle={`Overrides seasonal pricing. Charged in ${currency}.`}
      >
        <SegmentField
          label="Pricing model"
          value={form.price_mode}
          onChange={(v) => set("price_mode", v)}
          options={[
            {
              value: "flat",
              label: "Flat package",
              hint: "One total, any occupancy",
            },
            {
              value: "per_night",
              label: "Per night",
              hint: "Override nightly rate",
            },
          ]}
        />
        {form.price_mode === "flat" ? (
          <NumberField
            label="Package total"
            value={form.flat_total}
            min={0}
            step={0.01}
            prefix={currency}
            onChange={(v) => set("flat_total", v)}
            hint="One flat price for the whole stay."
          />
        ) : (
          <NumberField
            label="Price per night"
            value={form.per_night_price}
            min={0}
            step={0.01}
            prefix={currency}
            onChange={(v) => set("per_night_price", v)}
          />
        )}
        <NumberField
          label="Max guests"
          value={form.max_guests}
          min={1}
          max={100}
          onChange={(v) => set("max_guests", v)}
          hint="Leave blank to inherit the room / property maximum."
        />
      </Section>

      {/* Inventory + scheduling ------------------------------------- */}
      <Section title="Availability" subtitle="How many, and when it runs.">
        <NumberField
          label="Quantity"
          value={form.quantity}
          min={1}
          max={100000}
          onChange={(v) => set("quantity", v ?? 1)}
          hint="How many times this deal can be booked before it sells out."
        />
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Go live on"
            value={form.go_live_at}
            onChange={(v) => set("go_live_at", v)}
            hint="Optional — hidden until this date."
          />
          <DateField
            label="Book by"
            value={form.book_by}
            onChange={(v) => set("book_by", v)}
            hint="Optional — booking deadline."
          />
        </div>
      </Section>

      {/* Add-ons ----------------------------------------------------- */}
      <Section
        title="Add-ons"
        subtitle="Bundle extras as compulsory (always included) or optional upsells."
      >
        {data.addons.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[13px] text-brand-mute">
            You have no add-ons yet. Create some under Properties → Add-ons to
            bundle them onto a special.
          </p>
        ) : (
          <div className="space-y-2">
            {data.addons.map((addon) => {
              const selected = form.addons.find((a) => a.addon_id === addon.id);
              return (
                <div
                  key={addon.id}
                  className={`rounded-[10px] border p-3 transition ${
                    selected
                      ? "border-brand-primary/40 bg-brand-accent/20"
                      : "border-brand-line bg-white"
                  }`}
                >
                  <label className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-brand-ink">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={() => toggleAddon(addon.id)}
                        className="h-4 w-4 rounded border-brand-line text-brand-primary focus:ring-brand-primary"
                      />
                      {addon.name}
                    </span>
                    <span className="text-[12px] text-brand-mute">
                      {formatMoney(addon.unitPrice, addon.currency)}
                    </span>
                  </label>
                  {selected ? (
                    <div className="mt-3 grid grid-cols-2 items-end gap-3 border-t border-brand-line/70 pt-3">
                      <ToggleField
                        label="Compulsory"
                        hint="Always in the package"
                        checked={selected.is_required}
                        onChange={(v) =>
                          patchAddon(addon.id, { is_required: v })
                        }
                      />
                      <NumberField
                        label="Price override"
                        value={selected.unit_price_override}
                        min={0}
                        step={0.01}
                        prefix={currency}
                        onChange={(v) =>
                          patchAddon(addon.id, { unit_price_override: v })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Merchandising ---------------------------------------------- */}
      <Section
        title="Merchandising"
        subtitle="How the deal is categorised and surfaced."
      >
        <div>
          <span className="block text-[13px] font-semibold text-brand-ink">
            Categories
          </span>
          <span className="mt-0.5 block text-[12px] text-brand-mute">
            Powers the /specials directory filter.
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPECIAL_CATEGORIES.map((c) => {
              const on = form.categories.includes(c.key);
              return (
                <button
                  type="button"
                  key={c.key}
                  onClick={() => toggleCategory(c.key)}
                  className={`rounded-pill border px-3 py-1.5 text-[12.5px] font-medium transition ${
                    on
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-brand-line bg-white text-brand-ink hover:border-brand-mute"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <TagInput
          label="Custom tags"
          value={form.custom_tags}
          onChange={(v) => set("custom_tags", v)}
          hint="Your own free-form tags (shown on your website only)."
        />
        <TextField
          label="Badge"
          value={form.badge ?? ""}
          onChange={(v) => set("badge", v || null)}
          maxLength={40}
          placeholder="e.g. Winter escape"
          hint="Optional ribbon shown on the deal card."
        />
        <ToggleField
          label="Feature this special"
          hint="Pin it to the front of the directory and your website."
          checked={form.is_featured}
          onChange={(v) => set("is_featured", v)}
        />
      </Section>

      {/* Presentation ------------------------------------------------ */}
      <Section title="Presentation" subtitle="What guests see.">
        <TextField
          label="Title"
          value={form.title}
          onChange={(v) => set("title", v)}
          maxLength={120}
          placeholder="2 nights for the price of 1"
        />
        <TextArea
          label="Description"
          value={form.description ?? ""}
          onChange={(v) => set("description", v || null)}
          maxLength={2000}
          rows={4}
          placeholder="What's included, why it's a deal…"
        />
        {websiteId ? (
          <HeroImageField
            label="Hero image"
            websiteId={websiteId}
            path={form.hero_image_path}
            onChange={(p) => set("hero_image_path", p)}
            hint="Shown on the deal card and detail page."
          />
        ) : (
          <Field label="Hero image" hint="Optional.">
            <p className="mt-1.5 rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[12.5px] text-brand-mute">
              This property’s business needs a website before you can add a hero
              image. The deal will use the property’s own photos until then.
            </p>
          </Field>
        )}
      </Section>

      {/* Policy ------------------------------------------------------ */}
      <Section
        title="Cancellation policy"
        subtitle="By default a special inherits the property / room policy."
      >
        <SelectField
          label="Policy"
          value={form.cancellation_policy_id ?? ""}
          options={policyOptions}
          onChange={(v) => set("cancellation_policy_id", v || null)}
        />
      </Section>

      {/* Visibility -------------------------------------------------- */}
      <Section title="Where it shows" subtitle="Pick the surfaces.">
        <ToggleField
          label="Platform directory"
          hint="List on the cross-host /specials page."
          checked={form.show_in_directory}
          onChange={(v) => set("show_in_directory", v)}
        />
        <ToggleField
          label="Your website"
          hint="Show on this business’s Vilo website."
          checked={form.show_on_website}
          onChange={(v) => set("show_on_website", v)}
        />
        {linkOnly ? (
          <p className="rounded-[10px] border border-dashed border-brand-line bg-brand-light/40 px-3 py-2.5 text-[12.5px] text-brand-mute">
            With both off, the special is <strong>link-only</strong> — reachable
            only by sharing its direct link.
          </p>
        ) : null}
      </Section>

      {/* Save bar ---------------------------------------------------- */}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-2 rounded-card border border-brand-line bg-white/90 px-4 py-3 shadow-card backdrop-blur">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("draft")}
          className="inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save as draft
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("active")}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {mode === "edit" && initialStatus === "active"
            ? "Save & keep live"
            : "Save & publish"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-card border border-brand-line bg-white p-5 shadow-card">
      <h2 className="font-display text-base font-bold text-brand-ink">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-0.5 text-[13px] text-brand-mute">{subtitle}</p>
      ) : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function EmptyProperties() {
  return (
    <div className="rounded-card border border-dashed border-brand-line bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-card bg-brand-accent text-brand-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h1 className="font-display text-lg font-bold text-brand-ink">
        Add a property first
      </h1>
      <p className="mx-auto mt-1 max-w-md text-sm text-brand-mute">
        A special is built on one of your properties. Create a property before
        building a deal.
      </p>
      <Link
        href="/dashboard/properties"
        className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary"
      >
        Go to properties
      </Link>
    </div>
  );
}
