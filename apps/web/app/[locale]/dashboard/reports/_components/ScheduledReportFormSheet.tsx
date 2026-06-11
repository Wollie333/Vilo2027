"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const scheduledReportSchema = z.object({
  name: z.string().min(1, "Report name is required").max(100),
  description: z.string().max(500).optional(),
  report_type: z.enum([
    "portfolio_summary",
    "revenue_detail",
    "channel_mix",
    "guest_satisfaction",
    "refunds_cancellations",
    "occupancy_forecast",
  ]),
  schedule_preset: z.enum(["daily", "weekly", "monthly", "custom"]),
  schedule_cron: z.string().optional(),
  format: z.enum(["pdf", "csv", "xlsx"]),
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }),
    )
    .min(1, "At least one recipient is required"),
});

type ScheduledReportFormData = z.infer<typeof scheduledReportSchema>;

interface ScheduledReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  schedule_cron: string | null;
  schedule_label: string | null;
  format: string;
  recipients: Array<{ email: string; name: string }>;
}

interface ScheduledReportFormSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: ScheduledReportFormData) => Promise<void>;
  editingReport?: ScheduledReport | null;
}

export function ScheduledReportFormSheet({
  open,
  onClose,
  onSubmit,
  editingReport,
}: ScheduledReportFormSheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [newRecipientName, setNewRecipientName] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<ScheduledReportFormData>({
    resolver: zodResolver(scheduledReportSchema),
    defaultValues: editingReport
      ? {
          name: editingReport.name,
          description: editingReport.description || "",
          report_type:
            editingReport.report_type as ScheduledReportFormData["report_type"],
          schedule_preset: "custom" as const,
          schedule_cron: editingReport.schedule_cron || "",
          format: editingReport.format as ScheduledReportFormData["format"],
          recipients: editingReport.recipients,
        }
      : {
          name: "",
          description: "",
          report_type: "portfolio_summary" as const,
          schedule_preset: "monthly" as const,
          format: "pdf" as const,
          recipients: [],
        },
  });

  const schedulePreset = watch("schedule_preset");
  const recipients = watch("recipients") || [];

  const handleFormSubmit = async (data: ScheduledReportFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      reset();
      onClose();
    } catch (error) {
      console.error("Failed to save scheduled report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRecipient = () => {
    if (newRecipientEmail && newRecipientName) {
      const currentRecipients = recipients || [];
      setValue("recipients", [
        ...currentRecipients,
        { email: newRecipientEmail, name: newRecipientName },
      ]);
      setNewRecipientEmail("");
      setNewRecipientName("");
    }
  };

  const handleRemoveRecipient = (index: number) => {
    const currentRecipients = recipients || [];
    setValue(
      "recipients",
      currentRecipients.filter((_, i) => i !== index),
    );
  };

  const getCronFromPreset = (preset: string) => {
    const presets: Record<string, { cron: string; label: string }> = {
      daily: { cron: "0 8 * * *", label: "Daily · 08:00" },
      weekly: { cron: "0 8 * * 1", label: "Weekly · Monday · 08:00" },
      monthly: { cron: "0 8 1 * *", label: "Monthly · 1st · 08:00" },
    };
    return presets[preset] || { cron: "", label: "" };
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {editingReport ? "Edit" : "Create"} Scheduled Report
          </SheetTitle>
          <SheetDescription>
            Automate report generation and email delivery on a recurring
            schedule
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="mt-6 space-y-6"
        >
          {/* Report Name */}
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-brand-ink"
            >
              Report Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              {...register("name")}
              className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              placeholder="e.g., Monthly Performance Report"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="mb-1.5 block text-sm font-medium text-brand-ink"
            >
              Description
            </label>
            <textarea
              id="description"
              {...register("description")}
              rows={3}
              className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
              placeholder="Optional description for this report"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Report Type */}
          <div>
            <label
              htmlFor="report_type"
              className="mb-1.5 block text-sm font-medium text-brand-ink"
            >
              Report Type <span className="text-red-500">*</span>
            </label>
            <select
              id="report_type"
              {...register("report_type")}
              className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="portfolio_summary">Portfolio Summary</option>
              <option value="revenue_detail">Revenue Detail</option>
              <option value="channel_mix">Channel Mix</option>
              <option value="guest_satisfaction">Guest Satisfaction</option>
              <option value="refunds_cancellations">
                Refunds & Cancellations
              </option>
              <option value="occupancy_forecast">Occupancy Forecast</option>
            </select>
            {errors.report_type && (
              <p className="mt-1 text-xs text-red-600">
                {errors.report_type.message}
              </p>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label
              htmlFor="schedule_preset"
              className="mb-1.5 block text-sm font-medium text-brand-ink"
            >
              Schedule <span className="text-red-500">*</span>
            </label>
            <select
              id="schedule_preset"
              {...register("schedule_preset")}
              onChange={(e) => {
                const preset = e.target
                  .value as ScheduledReportFormData["schedule_preset"];
                setValue("schedule_preset", preset);
                if (preset !== "custom") {
                  const { cron } = getCronFromPreset(preset);
                  setValue("schedule_cron", cron);
                }
              }}
              className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="daily">Daily (08:00)</option>
              <option value="weekly">Weekly (Monday 08:00)</option>
              <option value="monthly">Monthly (1st, 08:00)</option>
              <option value="custom">Custom (cron expression)</option>
            </select>
          </div>

          {schedulePreset === "custom" && (
            <div>
              <label
                htmlFor="schedule_cron"
                className="mb-1.5 block text-sm font-medium text-brand-ink"
              >
                Cron Expression <span className="text-red-500">*</span>
              </label>
              <input
                id="schedule_cron"
                type="text"
                {...register("schedule_cron")}
                className="w-full rounded border border-brand-line px-3 py-2 font-mono text-sm focus:border-brand-primary focus:outline-none"
                placeholder="0 8 * * *"
              />
              <p className="mt-1 text-xs text-brand-mute">
                Format: minute hour day month weekday
              </p>
              {errors.schedule_cron && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.schedule_cron.message}
                </p>
              )}
            </div>
          )}

          {/* Format */}
          <div>
            <label
              htmlFor="format"
              className="mb-1.5 block text-sm font-medium text-brand-ink"
            >
              Format <span className="text-red-500">*</span>
            </label>
            <select
              id="format"
              {...register("format")}
              className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
            >
              <option value="pdf">PDF</option>
              <option value="csv">CSV</option>
              <option value="xlsx">XLSX (Excel)</option>
            </select>
            {errors.format && (
              <p className="mt-1 text-xs text-red-600">
                {errors.format.message}
              </p>
            )}
          </div>

          {/* Recipients */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brand-ink">
              Email Recipients <span className="text-red-500">*</span>
            </label>

            {/* Recipient List */}
            {recipients.length > 0 && (
              <div className="mb-3 space-y-2">
                {recipients.map((recipient, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded border border-brand-line bg-brand-light/30 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium text-brand-ink">
                        {recipient.name}
                      </div>
                      <div className="text-xs text-brand-mute">
                        {recipient.email}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(index)}
                      className="rounded p-1 text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Recipient Form */}
            <div className="space-y-2">
              <input
                type="text"
                value={newRecipientName}
                onChange={(e) => setNewRecipientName(e.target.value)}
                className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                placeholder="Name"
              />
              <input
                type="email"
                value={newRecipientEmail}
                onChange={(e) => setNewRecipientEmail(e.target.value)}
                className="w-full rounded border border-brand-line px-3 py-2 text-sm focus:border-brand-primary focus:outline-none"
                placeholder="email@example.com"
              />
              <button
                type="button"
                onClick={handleAddRecipient}
                disabled={!newRecipientEmail || !newRecipientName}
                className="inline-flex items-center gap-1.5 rounded border border-brand-line bg-white px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Add recipient
              </button>
            </div>

            {errors.recipients && (
              <p className="mt-1 text-xs text-red-600">
                {errors.recipients.message}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 border-t border-brand-line pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 rounded border border-brand-line bg-white px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-light disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded bg-brand-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : editingReport ? "Update" : "Create"}{" "}
              Report
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
