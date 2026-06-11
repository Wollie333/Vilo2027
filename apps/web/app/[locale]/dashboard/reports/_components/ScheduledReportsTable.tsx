"use client";

import { useState } from "react";
import {
  Clock,
  FileText,
  Mail,
  MoreVertical,
  Play,
  Pause,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ScheduledReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  schedule_cron: string | null;
  schedule_label: string | null;
  format: string;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  recipients: Array<{ email: string; name: string }>;
  scope_filter: Record<string, unknown>;
}

interface ScheduledReportsTableProps {
  reports: ScheduledReport[];
  onEdit: (report: ScheduledReport) => void;
  onDelete: (reportId: string) => void;
  onToggleActive: (reportId: string, isActive: boolean) => void;
  onCreate: () => void;
}

export function ScheduledReportsTable({
  reports,
  onEdit,
  onDelete,
  onToggleActive,
  onCreate,
}: ScheduledReportsTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDelete = async (reportId: string) => {
    setDeletingId(reportId);
    try {
      await onDelete(reportId);
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (
    reportId: string,
    currentActive: boolean,
  ) => {
    setTogglingId(reportId);
    try {
      await onToggleActive(reportId, !currentActive);
    } finally {
      setTogglingId(null);
    }
  };

  const formatReportType = (type: string) => {
    const types: Record<string, string> = {
      portfolio_summary: "Portfolio Summary",
      revenue_detail: "Revenue Detail",
      channel_mix: "Channel Mix",
      guest_satisfaction: "Guest Satisfaction",
      refunds_cancellations: "Refunds & Cancellations",
      occupancy_forecast: "Occupancy Forecast",
    };
    return types[type] || type;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-ZA", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-card border border-brand-line bg-white p-8 text-center">
        <Clock className="mx-auto mb-3 h-12 w-12 text-brand-mute" />
        <h3 className="mb-2 text-lg font-semibold text-brand-ink">
          No scheduled reports yet
        </h3>
        <p className="mb-4 text-sm text-brand-mute">
          Automate your reporting by scheduling regular exports to your inbox
        </p>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create first report
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-brand-ink">
          Scheduled Reports
        </h3>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light"
        >
          <Plus className="h-4 w-4" />
          New report
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-brand-line bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-brand-line bg-brand-light/50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Report
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Schedule
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Format
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Recipients
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Last Run
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Next Run
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-brand-mute">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-brand-mute">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line">
            {reports.map((report) => (
              <tr
                key={report.id}
                className="transition-colors hover:bg-brand-light/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-5 w-5 text-brand-primary" />
                    <div>
                      <div className="font-medium text-brand-ink">
                        {report.name}
                      </div>
                      <div className="text-xs text-brand-mute">
                        {formatReportType(report.report_type)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-brand-ink">
                    <Clock className="h-3.5 w-3.5 text-brand-mute" />
                    {report.schedule_label || "Custom"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-brand-accent px-2 py-0.5 text-xs font-medium uppercase text-brand-secondary">
                    {report.format}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-brand-ink">
                    <Mail className="h-3.5 w-3.5 text-brand-mute" />
                    {report.recipients.length}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-brand-mute">
                  {formatDate(report.last_run_at)}
                </td>
                <td className="px-4 py-3 text-sm text-brand-ink">
                  {formatDate(report.next_run_at)}
                </td>
                <td className="px-4 py-3">
                  {report.is_active ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                      Paused
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded p-1 transition-colors hover:bg-brand-light">
                      <MoreVertical className="h-4 w-4 text-brand-mute" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(report)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleToggleActive(report.id, report.is_active)
                        }
                        disabled={togglingId === report.id}
                      >
                        {report.is_active ? (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Activate
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(report.id)}
                        disabled={deletingId === report.id}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
