"use client";

import { useState } from "react";
import { ScheduledReportsTable } from "./ScheduledReportsTable";
import { ScheduledReportFormSheet } from "./ScheduledReportFormSheet";
import {
  createScheduledReportAction,
  updateScheduledReportAction,
  deleteScheduledReportAction,
  toggleScheduledReportActiveAction,
} from "../_actions/scheduledReportsActions";

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

interface ScheduledReportFormData {
  name: string;
  description?: string;
  report_type: string;
  schedule_cron?: string;
  schedule_preset: string;
  schedule_label?: string;
  format: string;
  recipients: Array<{ email: string; name: string }>;
}

interface ScheduledReportsSectionProps {
  initialReports: ScheduledReport[];
}

export function ScheduledReportsSection({
  initialReports,
}: ScheduledReportsSectionProps) {
  const [reports, setReports] = useState<ScheduledReport[]>(initialReports);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(
    null,
  );

  const handleCreate = () => {
    setEditingReport(null);
    setIsSheetOpen(true);
  };

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report);
    setIsSheetOpen(true);
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled report?")) {
      return;
    }

    const result = await deleteScheduledReportAction(reportId);
    if (result.success) {
      setReports(reports.filter((r) => r.id !== reportId));
    } else {
      alert(result.error || "Failed to delete report");
    }
  };

  const handleToggleActive = async (reportId: string, isActive: boolean) => {
    const result = await toggleScheduledReportActiveAction(reportId, isActive);
    if (result.success && result.data) {
      setReports(reports.map((r) => (r.id === reportId ? result.data : r)));
    } else {
      alert(result.error || "Failed to update report status");
    }
  };

  const handleSubmit = async (data: ScheduledReportFormData) => {
    // Calculate schedule label based on preset
    let scheduleLabel: string;
    if (data.schedule_preset !== "custom") {
      const labels: Record<string, string> = {
        daily: "Daily · 08:00",
        weekly: "Weekly · Monday · 08:00",
        monthly: "Monthly · 1st · 08:00",
      };
      scheduleLabel = labels[data.schedule_preset] || "Custom";
    } else {
      scheduleLabel = data.schedule_label || "Custom";
    }

    if (editingReport) {
      // Update existing report
      const result = await updateScheduledReportAction({
        id: editingReport.id,
        name: data.name,
        description: data.description,
        report_type: data.report_type,
        schedule_cron: data.schedule_cron || "0 8 * * *",
        schedule_label: scheduleLabel,
        format: data.format,
        recipients: data.recipients,
      });

      if (result.success && result.data) {
        setReports(
          reports.map((r) => (r.id === editingReport.id ? result.data : r)),
        );
      } else {
        throw new Error(result.error || "Failed to update report");
      }
    } else {
      // Create new report
      const result = await createScheduledReportAction({
        name: data.name,
        description: data.description,
        report_type: data.report_type,
        schedule_cron: data.schedule_cron || "0 8 * * *",
        schedule_label: scheduleLabel,
        format: data.format,
        recipients: data.recipients,
      });

      if (result.success && result.data) {
        setReports([result.data, ...reports]);
      } else {
        throw new Error(result.error || "Failed to create report");
      }
    }
  };

  return (
    <div>
      <ScheduledReportsTable
        reports={reports}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
        onCreate={handleCreate}
      />

      <ScheduledReportFormSheet
        open={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setEditingReport(null);
        }}
        onSubmit={handleSubmit}
        editingReport={editingReport}
      />
    </div>
  );
}
