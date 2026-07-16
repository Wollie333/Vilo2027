"use client";

// The "Your story" step (wizard arc slice 4). A short, conversational AI Q&A:
// the host answers up to three quick prompts, we generate on-brand copy (Sonnet)
// for the pieces that can't be pulled from their account, and they review/edit it
// inline. Empty/skipped → the theme's demo copy shows through at build time.
//
// English-first per the wizard plan; i18n keys can be layered on later.
import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

import type { ContentProfile } from "@/lib/website/contentProfile.schema";

import { generateWizardContentAction } from "../aiActions";
import type { WizardState } from "../wizardState";

const btnPrimary =
  "rounded-[10px] bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-secondary disabled:opacity-60";
const btnGhost =
  "rounded-[10px] border border-brand-line px-4 py-2.5 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-light";
const field =
  "w-full rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary";

export function StepStory({
  state,
  update,
  onNext,
  onBack,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const answers = state.answers;
  const profile = state.contentProfile;
  const hero = profile?.home?.hero ?? {};
  const generated = Boolean(profile);

  const setAnswer = (patch: Partial<typeof answers>) =>
    update({ answers: { ...answers, ...patch } });

  const setThing = (i: number, val: string) => {
    const arr = [...(answers.thingsToDo ?? ["", "", ""])];
    arr[i] = val;
    setAnswer({ thingsToDo: arr });
  };

  const patchProfile = (patch: ContentProfile) =>
    update({ contentProfile: { ...(profile ?? {}), ...patch } });

  async function generate() {
    setLoading(true);
    setNote(null);
    const res = await generateWizardContentAction(state.siteName, answers);
    setLoading(false);
    if (res.ok) {
      update({ contentProfile: res.profile });
    } else if (res.error === "ai_not_configured") {
      setNote(
        "AI copywriting isn't switched on yet — you can continue and the theme's starter copy will be used, or edit it in the builder later.",
      );
    } else if (res.error === "locked") {
      setNote("The website builder isn't enabled on your plan yet.");
    } else {
      setNote(
        res.detail
          ? `Couldn't write the copy: ${res.detail}`
          : "Couldn't write the copy just now. You can continue and edit it later.",
      );
    }
  }

  const thingsToDo = answers.thingsToDo ?? [];
  const experiences = profile?.experiences?.items ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-ink">
          Your story
        </h3>
        <p className="mt-0.5 text-[13px] text-brand-mute">
          Answer a few quick questions and we&apos;ll write your website copy.
          Your rooms, rates and photos come from your account automatically —
          this is just the words only you can write. You can edit all of it.
        </p>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-[13px] font-semibold text-brand-ink">
            In one line, what makes your place special?
          </label>
          <input
            type="text"
            value={answers.special ?? ""}
            onChange={(e) => setAnswer({ special: e.target.value })}
            placeholder="e.g. A restored beach house steps from the sand"
            className={field}
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-semibold text-brand-ink">
            Tell us the story of your place — why do you host?
          </label>
          <textarea
            value={answers.story ?? ""}
            onChange={(e) => setAnswer({ story: e.target.value })}
            placeholder="A sentence or two in your own words — we'll polish it."
            rows={3}
            className={field}
          />
        </div>

        <div>
          <label className="mb-1 block text-[13px] font-semibold text-brand-ink">
            Up to 3 things guests love to do nearby
          </label>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                type="text"
                value={thingsToDo[i] ?? ""}
                onChange={(e) => setThing(i, e.target.value)}
                placeholder={`Thing ${i + 1} (optional)`}
                className={field}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className={`inline-flex items-center gap-2 ${btnPrimary}`}
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : generated ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Writing…" : generated ? "Regenerate" : "Write my copy"}
        </button>
        {generated ? (
          <span className="text-[12px] text-brand-mute">
            Edit anything below — your changes are kept.
          </span>
        ) : null}
      </div>

      {note ? (
        <p className="rounded-[10px] border border-brand-line bg-brand-light px-3 py-2 text-[13px] text-brand-mute">
          {note}
        </p>
      ) : null}

      {/* Review / edit generated copy */}
      {generated ? (
        <div className="space-y-4 rounded-card border border-brand-line bg-brand-light/40 p-4">
          <ReviewField
            label="Home headline"
            value={hero.headline ?? ""}
            onChange={(v) =>
              patchProfile({
                home: {
                  ...(profile?.home ?? {}),
                  hero: { ...hero, headline: v },
                },
              })
            }
          />
          <ReviewField
            label="Home subheadline"
            value={hero.subheadline ?? ""}
            onChange={(v) =>
              patchProfile({
                home: {
                  ...(profile?.home ?? {}),
                  hero: { ...hero, subheadline: v },
                },
              })
            }
          />
          <ReviewField
            label="About story"
            multiline
            value={profile?.about?.story ?? ""}
            onChange={(v) =>
              patchProfile({ about: { ...(profile?.about ?? {}), story: v } })
            }
          />
          <ReviewField
            label="Host bio"
            multiline
            value={profile?.about?.hostBio?.body ?? ""}
            onChange={(v) =>
              patchProfile({
                about: { ...(profile?.about ?? {}), hostBio: { body: v } },
              })
            }
          />
          <ReviewField
            label="Experiences intro"
            value={profile?.experiences?.intro ?? ""}
            onChange={(v) =>
              patchProfile({
                experiences: { ...(profile?.experiences ?? {}), intro: v },
              })
            }
          />
          {experiences.length ? (
            <div>
              <span className="mb-1 block text-[12px] font-semibold text-brand-mute">
                Things to do
              </span>
              <ul className="flex flex-wrap gap-2">
                {experiences.map((e, i) => (
                  <li
                    key={i}
                    className="rounded-full border border-brand-line bg-white px-3 py-1 text-[12px] text-brand-ink"
                  >
                    {e.icon ? `${e.icon} ` : ""}
                    {e.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={onBack} className={btnGhost}>
          Back
        </button>
        <button type="button" onClick={onNext} className={btnPrimary}>
          {generated ? "Next" : "Skip for now"}
        </button>
      </div>
    </div>
  );
}

function ReviewField({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-semibold text-brand-mute">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={field}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={field}
        />
      )}
    </div>
  );
}
