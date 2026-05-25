"use client";

import { Plus, Save, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { saveListingPatchAction } from "../actions";
import type {
  EditorListing,
  ListingSchedule,
  ScheduleRecurringDay,
  ScheduleSpecificEntry,
} from "../Editor";

const DAYS: { value: ScheduleRecurringDay["day_of_week"]; short: string }[] = [
  { value: 1, short: "Mon" },
  { value: 2, short: "Tue" },
  { value: 3, short: "Wed" },
  { value: 4, short: "Thu" },
  { value: 5, short: "Fri" },
  { value: 6, short: "Sat" },
  { value: 0, short: "Sun" },
];

type Mode = "recurring" | "specific";

export function ScheduleTab({ listing }: { listing: EditorListing }) {
  const initial = listing.schedule;
  const [mode, setMode] = useState<Mode>(
    initial?.kind === "specific" ? "specific" : "recurring",
  );
  const [recurringDays, setRecurringDays] = useState<ScheduleRecurringDay[]>(
    initial?.kind === "recurring" ? initial.days : [],
  );
  const [specificDates, setSpecificDates] = useState<ScheduleSpecificEntry[]>(
    initial?.kind === "specific" ? initial.dates : [],
  );
  const [pending, start] = useTransition();

  function save() {
    let schedule: ListingSchedule | null = null;
    if (mode === "recurring" && recurringDays.length > 0) {
      // Drop days with no times — they're effectively empty.
      const cleaned = recurringDays
        .map((d) => ({
          day_of_week: d.day_of_week,
          times: d.times.filter((t) => /^\d{2}:\d{2}$/.test(t)),
        }))
        .filter((d) => d.times.length > 0);
      if (cleaned.length === 0) {
        toast.error("Add at least one time on a chosen day.");
        return;
      }
      schedule = { kind: "recurring", days: cleaned };
    } else if (mode === "specific" && specificDates.length > 0) {
      const cleaned = specificDates.filter(
        (d) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d.date) && /^\d{2}:\d{2}$/.test(d.time),
      );
      if (cleaned.length === 0) {
        toast.error("Add at least one valid date + time.");
        return;
      }
      schedule = { kind: "specific", dates: cleaned };
    }

    start(async () => {
      const result = await saveListingPatchAction(listing.id, { schedule });
      if (result.ok) toast.success("Schedule saved");
      else toast.error(result.error);
    });
  }

  function toggleDay(day: ScheduleRecurringDay["day_of_week"]) {
    setRecurringDays((prev) => {
      const exists = prev.find((d) => d.day_of_week === day);
      if (exists) return prev.filter((d) => d.day_of_week !== day);
      return [...prev, { day_of_week: day, times: ["09:00"] }];
    });
  }

  function setDayTime(
    day: ScheduleRecurringDay["day_of_week"],
    index: number,
    value: string,
  ) {
    setRecurringDays((prev) =>
      prev.map((d) =>
        d.day_of_week === day
          ? { ...d, times: d.times.map((t, i) => (i === index ? value : t)) }
          : d,
      ),
    );
  }

  function addDayTime(day: ScheduleRecurringDay["day_of_week"]) {
    setRecurringDays((prev) =>
      prev.map((d) =>
        d.day_of_week === day ? { ...d, times: [...d.times, "12:00"] } : d,
      ),
    );
  }

  function removeDayTime(
    day: ScheduleRecurringDay["day_of_week"],
    index: number,
  ) {
    setRecurringDays((prev) =>
      prev.map((d) =>
        d.day_of_week === day
          ? { ...d, times: d.times.filter((_, i) => i !== index) }
          : d,
      ),
    );
  }

  function addSpecific() {
    setSpecificDates((prev) => [
      ...prev,
      { date: new Date().toISOString().slice(0, 10), time: "09:00" },
    ]);
  }

  function updateSpecific(
    index: number,
    patch: Partial<ScheduleSpecificEntry>,
  ) {
    setSpecificDates((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  function removeSpecific(index: number) {
    setSpecificDates((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Schedule
        </CardTitle>
        <CardDescription className="text-brand-mute">
          When this experience runs. Pick recurring weekly slots or list
          specific dates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          {(["recurring", "specific"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-card border p-4 text-left transition-colors ${
                mode === m
                  ? "border-brand-primary bg-brand-accent/50"
                  : "border-brand-line bg-white hover:bg-brand-light/60"
              }`}
            >
              <div className="font-display text-sm font-semibold text-brand-dark">
                {m === "recurring" ? "Recurring weekly" : "Specific dates"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-mute">
                {m === "recurring"
                  ? "Same days every week — e.g. Tue/Thu/Sat at 06:30."
                  : "One-off dates and times — e.g. workshop on 12 June at 14:00."}
              </p>
            </button>
          ))}
        </div>

        {mode === "recurring" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DAYS.map(({ value, short }) => {
                const active = recurringDays.some(
                  (d) => d.day_of_week === value,
                );
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDay(value)}
                    className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                        : "border-brand-line bg-white text-brand-mute hover:bg-brand-light/60"
                    }`}
                  >
                    {short}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {DAYS.filter((d) =>
                recurringDays.some((r) => r.day_of_week === d.value),
              ).map(({ value, short }) => {
                const day = recurringDays.find((d) => d.day_of_week === value)!;
                return (
                  <div
                    key={value}
                    className="rounded border border-brand-line bg-white p-3"
                  >
                    <div className="mb-2 text-sm font-semibold text-brand-dark">
                      {short}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {day.times.map((t, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <Input
                            type="time"
                            value={t}
                            onChange={(e) =>
                              setDayTime(value, i, e.target.value)
                            }
                            className="w-[120px]"
                          />
                          <button
                            type="button"
                            onClick={() => removeDayTime(value, i)}
                            className="hover:text-brand-danger text-brand-mute transition-colors"
                            aria-label={`Remove time ${t}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addDayTime(value)}
                        className="gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add time
                      </Button>
                    </div>
                  </div>
                );
              })}
              {recurringDays.length === 0 ? (
                <p className="text-sm text-brand-mute">
                  Pick a day above to add session times.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {specificDates.map((d, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded border border-brand-line bg-white p-3"
              >
                <Input
                  type="date"
                  value={d.date}
                  onChange={(e) => updateSpecific(i, { date: e.target.value })}
                  className="w-[180px]"
                />
                <Input
                  type="time"
                  value={d.time}
                  onChange={(e) => updateSpecific(i, { time: e.target.value })}
                  className="w-[120px]"
                />
                <button
                  type="button"
                  onClick={() => removeSpecific(i)}
                  className="hover:text-brand-danger ml-auto text-brand-mute transition-colors"
                  aria-label="Remove date"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSpecific}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add date
            </Button>
            {specificDates.length === 0 ? (
              <p className="text-sm text-brand-mute">
                No specific dates yet. Add one above.
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            type="button"
            onClick={save}
            disabled={pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save schedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
