"use client";

import { useState } from "react";
import { FileText, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";

export interface MessageTemplate {
  id: string;
  title: string;
  body: string;
}

interface TemplateQuickPickerProps {
  templates: MessageTemplate[];
  onSelect: (template: MessageTemplate) => void;
  selectedId?: string;
}

export function TemplateQuickPicker({
  templates,
  onSelect,
  selectedId,
}: TemplateQuickPickerProps) {
  const [open, setOpen] = useState(false);

  if (templates.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-brand-mute">
        <FileText className="h-4 w-4" />
        <span>No templates.</span>
        <Link
          href="/dashboard/inbox/templates"
          className="text-brand-primary hover:underline"
        >
          Create one
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-brand-mute hover:text-brand-ink"
        >
          <FileText className="h-4 w-4" />
          Use template
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-brand-mute">
          Quick-load a saved message
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() => {
              onSelect(template);
              setOpen(false);
            }}
            className="flex items-center justify-between"
          >
            <span className="truncate">{template.title}</span>
            {selectedId === template.id && (
              <Check className="h-4 w-4 shrink-0 text-brand-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/dashboard/inbox/templates"
            className="text-brand-mute hover:text-brand-ink"
          >
            Manage templates...
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
