"use client";

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Download,
  ExternalLink,
  Inbox,
  MailOpen,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTranslations } from "next-intl";

import { setSubmissionStatusAction } from "@/app/[locale]/dashboard/website/actions";

import type { FormSubmissionRow, ResponseFormMeta } from "./loadFormResponses";

type StatusFilter = "active" | "archived" | "all";

/** Trigger a client-side file download. */
function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Quote a CSV cell (wrap + double embedded quotes). */
function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export function ResponsesManager({
  websiteId,
  forms,
  submissions: initial,
  initialFormId,
}: {
  websiteId: string;
  forms: ResponseFormMeta[];
  submissions: FormSubmissionRow[];
  initialFormId: string;
}) {
  const t = useTranslations("website");
  const [submissions, setSubmissions] = useState(initial);
  const [formFilter, setFormFilter] = useState<string>(
    forms.some((f) => f.id === initialFormId) ? initialFormId : "all",
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const formById = useMemo(() => new Map(forms.map((f) => [f.id, f])), [forms]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Local-day bounds: "from" at 00:00, "to" through 23:59:59 so both ends are
    // inclusive of the picked calendar day.
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
    return submissions.filter((s) => {
      if (formFilter !== "all" && s.formId !== formFilter) return false;
      if (statusFilter === "active") {
        if (s.status !== "new" && s.status !== "read") return false;
      } else if (statusFilter === "archived") {
        if (s.status !== "archived" && s.status !== "spam") return false;
      }
      if (fromMs !== null || toMs !== null) {
        const ms = new Date(s.createdAt).getTime();
        if (fromMs !== null && ms < fromMs) return false;
        if (toMs !== null && ms > toMs) return false;
      }
      if (q) {
        const form = formById.get(s.formId);
        const hay = [form?.name ?? "", ...Object.values(s.data)]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    submissions,
    formFilter,
    statusFilter,
    query,
    fromDate,
    toDate,
    formById,
  ]);

  function patchStatus(id: string, status: FormSubmissionRow["status"]) {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
    startTransition(async () => {
      const res = await setSubmissionStatusAction({
        websiteId,
        submissionId: id,
        status,
      });
      if (!res.ok) {
        toast.error(t("responsesUpdateError"));
        // Reload from server state on failure.
        setSubmissions(initial);
      }
    });
  }

  function toggleExpand(s: FormSubmissionRow) {
    const next = expanded === s.id ? null : s.id;
    setExpanded(next);
    // Auto-mark a new submission as read when first opened.
    if (next && s.status === "new") patchStatus(s.id, "read");
  }

  /** Human label for a field id, falling back to the raw key. */
  function labelFor(formId: string, key: string): string {
    const f = formById.get(formId)?.fields.find((fl) => fl.id === key);
    return f?.label ?? key;
  }

  function summaryOf(s: FormSubmissionRow): string {
    const form = formById.get(s.formId);
    const order = form?.fields.map((f) => f.id) ?? Object.keys(s.data);
    const parts = order
      .map((k) => s.data[k])
      .filter((v) => v && v.trim().length > 0)
      .slice(0, 2);
    return parts.join(" · ") || t("responsesEmpty");
  }

  function exportCsv() {
    if (formFilter === "all") return;
    const form = formById.get(formFilter);
    if (!form) return;
    const rows = visible.filter((s) => s.formId === formFilter);
    const headers = [
      ...form.fields.map((f) => f.label),
      t("responsesColSubmitted"),
      t("responsesColStatus"),
    ];
    const lines = [headers.map(csvCell).join(",")];
    for (const s of rows) {
      const cells = [
        ...form.fields.map((f) => s.data[f.id] ?? ""),
        new Date(s.createdAt).toISOString(),
        s.status,
      ];
      lines.push(cells.map(csvCell).join(","));
    }
    const safeName = form.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    download(
      `${safeName}-responses.csv`,
      lines.join("\r\n"),
      "text/csv;charset=utf-8",
    );
  }

  const selectCls =
    "rounded-[10px] border border-brand-line bg-white px-3 py-2 text-sm text-brand-ink outline-none focus:border-brand-primary";

  return (
    <div className="space-y-4">
      {/* Filters + export */}
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={formFilter}
          onChange={(e) => setFormFilter(e.target.value)}
          className={selectCls}
          aria-label={t("responsesFilterForm")}
        >
          <option value="all">{t("responsesAllForms")}</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={selectCls}
          aria-label={t("responsesFilterStatus")}
        >
          <option value="active">{t("responsesStatusActive")}</option>
          <option value="archived">{t("responsesStatusArchived")}</option>
          <option value="all">{t("responsesStatusAll")}</option>
        </select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-mute" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("responsesSearchPh")}
            aria-label={t("responsesSearchPh")}
            className="w-[180px] rounded-[10px] border border-brand-line bg-white py-2 pl-8 pr-3 text-sm text-brand-ink outline-none focus:border-brand-primary"
          />
        </div>
        <input
          type="date"
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label={t("responsesDateFrom")}
          title={t("responsesDateFrom")}
          className={selectCls}
        />
        <input
          type="date"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
          aria-label={t("responsesDateTo")}
          title={t("responsesDateTo")}
          className={selectCls}
        />
        <span className="text-[13px] text-brand-mute">
          {t("responsesCount", { count: visible.length })}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={formFilter === "all" || visible.length === 0}
          title={
            formFilter === "all" ? t("responsesExportPickForm") : undefined
          }
          className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border border-brand-line bg-white px-3 py-2 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {t("responsesExport")}
        </button>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-brand-line bg-white px-4 py-10 text-center text-sm text-brand-mute">
          {t("responsesNone")}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((s) => {
            const open = expanded === s.id;
            const form = formById.get(s.formId);
            const isNew = s.status === "new";
            return (
              <li
                key={s.id}
                className="overflow-hidden rounded-[12px] border border-brand-line bg-white"
              >
                <button
                  type="button"
                  onClick={() => toggleExpand(s)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-light/40"
                >
                  {isNew ? (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand-primary" />
                  ) : (
                    <span className="h-2 w-2 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[14px] ${
                        isNew
                          ? "font-bold text-brand-ink"
                          : "font-medium text-brand-ink"
                      }`}
                    >
                      {summaryOf(s)}
                    </span>
                    <span className="block text-[12px] text-brand-mute">
                      {form?.name ?? t("responsesUnknownForm")} ·{" "}
                      {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </span>
                  {s.status === "archived" ? (
                    <span className="shrink-0 rounded-full bg-brand-light px-2 py-0.5 text-[11px] font-semibold text-brand-mute">
                      {t("responsesStatusArchivedTag")}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-brand-mute transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {open ? (
                  <div className="border-t border-brand-line px-4 py-3.5">
                    <dl className="space-y-2">
                      {Object.entries(s.data).length === 0 ? (
                        <p className="text-[13px] text-brand-mute">
                          {t("responsesEmpty")}
                        </p>
                      ) : (
                        Object.entries(s.data).map(([k, v]) => (
                          <div
                            key={k}
                            className="grid grid-cols-[140px_1fr] gap-3 text-[13px]"
                          >
                            <dt className="font-semibold text-brand-mute">
                              {labelFor(s.formId, k)}
                            </dt>
                            <dd className="whitespace-pre-wrap break-words text-brand-ink">
                              {v}
                            </dd>
                          </div>
                        ))
                      )}
                    </dl>

                    <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-brand-line pt-3">
                      {s.conversationId ? (
                        <Link
                          href={`/dashboard/inbox?f=enquiries&c=${s.conversationId}`}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-line px-2.5 py-1.5 text-[12.5px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
                        >
                          <Inbox className="h-3.5 w-3.5" />
                          {t("responsesOpenInbox")}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      ) : null}
                      {s.status !== "read" && s.status !== "new" ? (
                        <button
                          type="button"
                          onClick={() => patchStatus(s.id, "new")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-line px-2.5 py-1.5 text-[12.5px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" />
                          {t("responsesRestore")}
                        </button>
                      ) : null}
                      {s.status === "new" ? (
                        <button
                          type="button"
                          onClick={() => patchStatus(s.id, "read")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-line px-2.5 py-1.5 text-[12.5px] font-medium text-brand-ink transition-colors hover:bg-brand-light"
                        >
                          <MailOpen className="h-3.5 w-3.5" />
                          {t("responsesMarkRead")}
                        </button>
                      ) : null}
                      {s.status !== "archived" ? (
                        <button
                          type="button"
                          onClick={() => patchStatus(s.id, "archived")}
                          className="inline-flex items-center gap-1.5 rounded-[8px] border border-brand-line px-2.5 py-1.5 text-[12.5px] font-medium text-brand-mute transition-colors hover:bg-brand-light hover:text-brand-ink"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {t("responsesArchive")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
