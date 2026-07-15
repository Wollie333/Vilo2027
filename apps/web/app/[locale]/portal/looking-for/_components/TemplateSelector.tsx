"use client";

import { useState } from "react";
import {
  Palmtree,
  Users,
  Heart,
  Briefcase,
  PartyPopper,
  Wine,
  Mountain,
  Building2,
  Sparkles,
  Check,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REQUEST_TEMPLATES, type RequestTemplate } from "./request-templates";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Palmtree,
  Users,
  Heart,
  Briefcase,
  PartyPopper,
  Wine,
  Mountain,
  Building2,
};

interface TemplateSelectorProps {
  onSelect: (template: RequestTemplate) => void;
  selectedId?: string;
}

// A compact "Use a template" trigger + a modal picker — keeps the quick-start
// presets without letting an 8-tile grid dominate the Basics step.
export function TemplateSelector({
  onSelect,
  selectedId,
}: TemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const selected = REQUEST_TEMPLATES.find((t) => t.id === selectedId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand-line bg-brand-light/40 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-brand-mute">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-primary" />
        {selected ? (
          <span className="truncate">
            Using{" "}
            <span className="font-medium text-brand-ink">{selected.name}</span>{" "}
            — edit anything below.
          </span>
        ) : (
          <span className="truncate">Not sure where to start?</span>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Sparkles className="h-4 w-4" />
        {selected ? "Change template" : "Use a template"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Quick start templates</DialogTitle>
            <DialogDescription>
              Pick one to pre-fill your request — you can edit everything
              afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] grid-cols-1 gap-2.5 overflow-y-auto py-1 sm:grid-cols-2">
            {REQUEST_TEMPLATES.map((template) => {
              const Icon = ICON_MAP[template.icon] || Palmtree;
              const isSelected = selectedId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    onSelect(template);
                    setOpen(false);
                  }}
                  className={`group flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-brand-primary hover:bg-brand-accent ${
                    isSelected
                      ? "border-brand-primary bg-brand-accent ring-2 ring-brand-primary/20"
                      : "border-brand-line bg-white"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                      isSelected
                        ? "bg-brand-primary text-white"
                        : "bg-brand-light text-brand-primary group-hover:bg-brand-primary group-hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-brand-ink">
                      {template.name}
                    </div>
                    <div className="truncate text-[11px] text-brand-mute">
                      {template.description}
                    </div>
                  </div>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-brand-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
