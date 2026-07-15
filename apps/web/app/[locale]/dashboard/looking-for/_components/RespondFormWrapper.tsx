"use client";

import { useState, useCallback } from "react";
import {
  QuoteForm,
  type QuoteFormListing,
  type QuoteFormInitial,
} from "../../quotes/QuoteForm";
import {
  TemplateQuickPicker,
  type MessageTemplate,
} from "./TemplateQuickPicker";

interface RespondFormWrapperProps {
  listings: QuoteFormListing[];
  initial: QuoteFormInitial;
  templates: MessageTemplate[];
  guestName: string;
  /** Quotes-only account → custom/upload quote only (no listings to pick). */
  quotesOnly?: boolean;
}

export function RespondFormWrapper({
  listings,
  initial,
  templates,
  guestName,
  quotesOnly = false,
}: RespondFormWrapperProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>();
  const [notes, setNotes] = useState(initial.notes ?? "");

  const handleTemplateSelect = useCallback(
    (template: MessageTemplate) => {
      setSelectedTemplateId(template.id);

      // Replace merge tokens with actual values
      let body = template.body;
      body = body.replace(/\{\{guest_name\}\}/gi, guestName || "Guest");
      body = body.replace(
        /\{\{check_in\}\}/gi,
        initial.checkIn || "[Check-in date]",
      );
      body = body.replace(
        /\{\{check_out\}\}/gi,
        initial.checkOut || "[Check-out date]",
      );
      body = body.replace(/\{\{listing_name\}\}/gi, "[Your listing]");

      setNotes(body);
    },
    [guestName, initial.checkIn, initial.checkOut],
  );

  return (
    <div className="space-y-4">
      {/* Template picker */}
      {templates.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-brand-line bg-brand-light/50 p-3">
          <div className="text-sm text-brand-mute">
            Speed up your response with a saved template
          </div>
          <TemplateQuickPicker
            templates={templates}
            onSelect={handleTemplateSelect}
            selectedId={selectedTemplateId}
          />
        </div>
      )}

      {/* Quote form with updated notes */}
      <QuoteForm
        listings={listings}
        quotesOnly={quotesOnly}
        initial={{
          ...initial,
          notes,
        }}
        key={selectedTemplateId ?? "default"} // Force re-render when template changes
      />
    </div>
  );
}
