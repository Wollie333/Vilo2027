"use client";

import { Check, Trash2, Wrench } from "lucide-react";
import { useState, useTransition } from "react";

import { updateSuggestionStatus } from "./actions";

type Row = {
  id: string;
  email: string | null;
  message: string;
  status: "open" | "planned" | "shipped" | "dismissed";
  created_at: string;
};

const NEXT_STATUS_BUTTONS: {
  label: string;
  status: Row["status"];
  icon: React.ComponentType<{ className?: string }>;
  className: string;
}[] = [
  {
    label: "Plan",
    status: "planned",
    icon: Wrench,
    className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  },
  {
    label: "Shipped",
    status: "shipped",
    icon: Check,
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  },
  {
    label: "Dismiss",
    status: "dismissed",
    icon: Trash2,
    className: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  },
];

export function SuggestionRow({ row }: { row: Row }) {
  const [status, setStatus] = useState<Row["status"]>(row.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setNext(next: Row["status"]) {
    setError(null);
    startTransition(async () => {
      const res = await updateSuggestionStatus({ id: row.id, status: next });
      if (!res.ok) setError(res.error);
      else setStatus(next);
    });
  }

  return (
    <li className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-brand-ink">
            {row.message}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-mute">
            {row.email ? <span className="font-mono">{row.email}</span> : null}
            <span>
              · {new Date(row.created_at).toLocaleDateString("en-ZA")}
            </span>
            <StatusPill status={status} />
          </div>
          {error ? (
            <div className="mt-1 text-[11px] text-red-700">{error}</div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {NEXT_STATUS_BUTTONS.map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.status}
                type="button"
                disabled={pending || status === b.status}
                onClick={() => setNext(b.status)}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium ${b.className} disabled:opacity-50`}
              >
                <Icon className="h-3 w-3" /> {b.label}
              </button>
            );
          })}
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  const cls: Record<Row["status"], string> = {
    open: "bg-amber-100 text-amber-800",
    planned: "bg-blue-100 text-blue-800",
    shipped: "bg-emerald-100 text-emerald-800",
    dismissed: "bg-brand-light text-brand-mute",
  };
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold capitalize ${cls[status]}`}
    >
      {status}
    </span>
  );
}
