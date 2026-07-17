"use client";

import { ImagePlus, RefreshCw, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";
import { websiteAssetUrl } from "@/lib/website/assets";

import { createWizardImageUploadUrl } from "../actions";
import {
  generateWizardContentAction,
  writeWizardSlotAction,
} from "./aiActions";
import {
  PAGE_SECTIONS,
  aiSlotFor,
  getExpItems,
  getImageSlot,
  getTextSlot,
  setExpItems,
  setImageSlot,
  setTextSlot,
  type ExpItem,
  type ImageSlotId,
  type SectionSpec,
  type TextField as TextFieldSpec,
} from "./pageSections";
import type { WizardState } from "./wizardState";

const field =
  "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary";

/** Expanded panel for one page: its sections, each with an AI content form,
 *  image slot (with the ideal size), or a "from your listing" note. */
export function PageSectionsPanel({
  pageKind,
  state,
  update,
}: {
  pageKind: string;
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  const sections = PAGE_SECTIONS[pageKind] ?? [];
  const [drafting, setDrafting] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const profile = state.contentProfile ?? {};

  const setProfile = (next: typeof profile) => update({ contentProfile: next });

  async function draftWithAI() {
    setDrafting(true);
    setNote(null);
    const res = await generateWizardContentAction(
      state.siteName,
      state.answers,
    );
    setDrafting(false);
    if (res.ok) {
      update({ contentProfile: res.profile });
    } else if (res.error === "ai_not_configured") {
      setNote(
        "AI copywriting isn't switched on yet — write your content here, or turn it on later.",
      );
    } else {
      setNote(
        res.detail
          ? `Couldn't draft just now: ${res.detail}`
          : "Couldn't draft just now — you can write it here.",
      );
    }
  }

  const hasContent = sections.some((s) => s.kind === "content");

  return (
    <div className="space-y-4 border-t border-brand-line bg-brand-light/30 px-4 py-4">
      {hasContent ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={draftWithAI}
            disabled={drafting}
            className="inline-flex items-center gap-2 rounded-[10px] bg-brand-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60"
          >
            {drafting ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {drafting ? "Drafting…" : "Draft this page with AI"}
          </button>
          <span className="text-[12px] text-brand-mute">
            Uses your answers from the Story step. Edit anything below.
          </span>
        </div>
      ) : null}

      {note ? (
        <p className="rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[12px] text-brand-mute">
          {note}
        </p>
      ) : null}

      <div className="space-y-3">
        {sections.map((s) => (
          <SectionCard
            key={s.key}
            spec={s}
            profile={profile}
            setProfile={setProfile}
            siteName={state.siteName}
            answers={state.answers}
          />
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  spec,
  profile,
  setProfile,
  siteName,
  answers,
}: {
  spec: SectionSpec;
  profile: WizardState["contentProfile"] & object;
  setProfile: (p: NonNullable<WizardState["contentProfile"]>) => void;
  siteName: string;
  answers: WizardState["answers"];
}) {
  const p = profile ?? {};
  const isContent = spec.kind === "content";
  return (
    <div className="rounded-card border border-brand-line bg-white p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-brand-ink">
          {spec.label}
        </span>
        <span
          className={`shrink-0 rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            isContent
              ? "bg-brand-primary/10 text-brand-primary"
              : "bg-brand-light text-brand-mute"
          }`}
        >
          {isContent ? "You write this" : "From your listing"}
        </span>
      </div>

      {spec.note ? (
        <p className="text-[12px] leading-relaxed text-brand-mute">
          {spec.note}
        </p>
      ) : null}

      {spec.fields?.map((f) => (
        <AiTextField
          key={f.slot}
          spec={f}
          value={getTextSlot(p, f.slot)}
          onChange={(v) => setProfile(setTextSlot(p, f.slot, v))}
          siteName={siteName}
          answers={answers}
        />
      ))}

      {spec.image ? (
        <ImageDrop
          label={spec.image.label}
          size={spec.image.size}
          shape={spec.image.shape}
          value={getImageSlot(p, spec.image.slot)}
          onChange={(path) =>
            setProfile(setImageSlot(p, spec.image!.slot as ImageSlotId, path))
          }
        />
      ) : null}

      {spec.items === "experiences" ? (
        <ExperiencesEditor
          items={getExpItems(p)}
          onChange={(items) => setProfile(setExpItems(p, items))}
        />
      ) : null}
    </div>
  );
}

function AiTextField({
  spec,
  value,
  onChange,
  siteName,
  answers,
}: {
  spec: TextFieldSpec;
  value: string;
  onChange: (v: string) => void;
  siteName: string;
  answers: WizardState["answers"];
}) {
  const ai = aiSlotFor(spec.slot);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function writeWithAi() {
    if (!ai) return;
    setBusy(true);
    setErr(null);
    const res = await writeWizardSlotAction(siteName, ai, answers);
    setBusy(false);
    if (res.ok) onChange(res.value);
    else if (res.error === "ai_not_configured")
      setErr("AI isn't switched on yet — type it here.");
    else setErr("Couldn't write it — try again or type it here.");
  }

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-brand-mute">
          {spec.label}
        </span>
        {ai ? (
          <button
            type="button"
            onClick={writeWithAi}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-full border border-brand-line bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-primary hover:bg-brand-light disabled:opacity-60"
          >
            {busy ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {busy ? "Writing…" : "Write with AI"}
          </button>
        ) : null}
      </div>
      {spec.multiline ? (
        <textarea
          rows={3}
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={spec.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      )}
      {err ? <p className="mt-0.5 text-[11px] text-red-500">{err}</p> : null}
    </div>
  );
}

function ExperiencesEditor({
  items,
  onChange,
}: {
  items: ExpItem[];
  onChange: (items: ExpItem[]) => void;
}) {
  const rows: ExpItem[] = [0, 1, 2].map((i) => items[i] ?? {});
  const setRow = (i: number, patch: Partial<ExpItem>) => {
    const next = rows.map((r, j) => (j === i ? { ...r, ...patch } : r));
    onChange(next);
  };
  return (
    <div className="mt-3 space-y-2">
      <span className="block text-[12px] font-semibold text-brand-mute">
        Up to 3 experience cards
      </span>
      {rows.map((r, i) => (
        <div key={i} className="rounded-[10px] border border-brand-line p-2.5">
          <input
            type="text"
            value={r.title ?? ""}
            placeholder={`Card ${i + 1} title (e.g. Game drives)`}
            onChange={(e) => setRow(i, { title: e.target.value })}
            className={`${field} mb-1.5`}
          />
          <textarea
            rows={2}
            value={r.body ?? ""}
            placeholder="A line about it (optional)"
            onChange={(e) => setRow(i, { body: e.target.value })}
            className={field}
          />
          <ImageDrop
            label="Card image"
            size="800 × 600 px"
            shape="landscape"
            value={r.imagePath}
            onChange={(path) => setRow(i, { imagePath: path })}
            compact
          />
        </div>
      ))}
    </div>
  );
}

function ImageDrop({
  label,
  size,
  shape,
  value,
  onChange,
  compact,
}: {
  label: string;
  size: string;
  shape: "landscape" | "square" | "portrait";
  value: string | undefined;
  onChange: (path: string | undefined) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = websiteAssetUrl(value ?? undefined);

  async function onFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const res = await createWizardImageUploadUrl(ext);
      if (!res.ok) {
        setErr("Upload isn't available right now.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("website-assets")
        .uploadToSignedUrl(res.data.path, res.data.token, file, {
          contentType: file.type || "image/jpeg",
        });
      if (error) {
        setErr("Upload failed — please try again.");
        return;
      }
      onChange(res.data.path);
    } finally {
      setBusy(false);
    }
  }

  const box = shape === "square" ? "h-16 w-16" : "h-16 w-24";

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      {!compact ? (
        <span className="mb-1 block text-[12px] font-semibold text-brand-mute">
          {label}
        </span>
      ) : null}
      <div className="flex items-center gap-3">
        <div
          className={`${box} shrink-0 overflow-hidden rounded-[10px] border border-brand-line bg-brand-light`}
          style={
            url
              ? {
                  backgroundImage: `url(${url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!url ? (
            <div className="flex h-full w-full items-center justify-center text-brand-line">
              <ImagePlus className="h-5 w-5" />
            </div>
          ) : null}
        </div>
        <div className="min-w-0">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-brand-line bg-white px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-brand-light">
            <ImagePlus className="h-3.5 w-3.5" />
            {busy ? "Uploading…" : url ? "Replace" : "Add image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {url ? (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="ml-2 inline-flex items-center gap-1 text-[12px] text-brand-mute hover:text-brand-ink"
            >
              <X className="h-3 w-3" /> Remove
            </button>
          ) : null}
          <p className="mt-1 text-[11px] text-brand-mute">
            Ideal size {size} · {shape}
          </p>
          {err ? (
            <p className="mt-0.5 text-[11px] text-red-500">{err}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
