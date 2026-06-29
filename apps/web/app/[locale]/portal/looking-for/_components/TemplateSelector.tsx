"use client";

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
} from "lucide-react";
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

export function TemplateSelector({
  onSelect,
  selectedId,
}: TemplateSelectorProps) {
  return (
    <div className="rounded-card border border-brand-line bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-brand-primary" />
        <h2 className="font-display font-semibold text-brand-ink">
          Quick Start Templates
        </h2>
      </div>
      <p className="mb-4 text-sm text-brand-mute">
        Select a template to pre-fill your request, or skip to start from
        scratch.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {REQUEST_TEMPLATES.map((template) => {
          const Icon = ICON_MAP[template.icon] || Palmtree;
          const isSelected = selectedId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={`group flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all hover:border-brand-primary hover:bg-brand-accent ${
                isSelected
                  ? "border-brand-primary bg-brand-accent ring-2 ring-brand-primary/20"
                  : "border-brand-line bg-white"
              }`}
            >
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  isSelected
                    ? "bg-brand-primary text-white"
                    : "bg-brand-light text-brand-primary group-hover:bg-brand-primary group-hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium text-brand-ink">
                  {template.name}
                </div>
                <div className="text-[11px] text-brand-mute">
                  {template.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
