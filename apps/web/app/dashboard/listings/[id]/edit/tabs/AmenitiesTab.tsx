"use client";

import { Save } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";

import { replaceAmenitiesAction } from "../actions";
import { AMENITY_OPTIONS } from "../schemas";

export function AmenitiesTab({
  listingId,
  initial,
}: {
  listingId: string;
  initial: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initial));
  const [pending, start] = useTransition();

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function save() {
    start(async () => {
      const result = await replaceAmenitiesAction(
        listingId,
        Array.from(selected),
      );
      if (result.ok) toast.success("Amenities saved");
      else toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-card border-brand-line shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-xl font-bold text-brand-dark">
          Amenities
        </CardTitle>
        <CardDescription className="text-brand-mute">
          Check whatever applies. Save replaces the whole set.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITY_OPTIONS.map((a) => {
            const checked = selected.has(a.key);
            return (
              <label
                key={a.key}
                className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                  checked
                    ? "border-brand-primary bg-brand-accent/50 text-brand-dark"
                    : "border-brand-line bg-white text-brand-ink hover:bg-brand-light/60"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(a.key)}
                />
                {a.label}
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs text-brand-mute">
            {selected.size} selected
          </div>
          <Button
            type="button"
            onClick={save}
            disabled={pending}
            className="gap-1.5"
          >
            <Save className="h-4 w-4" />
            {pending ? "Saving…" : "Save amenities"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
