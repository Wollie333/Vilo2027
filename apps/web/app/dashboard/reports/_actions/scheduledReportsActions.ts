"use server";

import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

interface CreateScheduledReportInput {
  name: string;
  description?: string;
  report_type: string;
  schedule_cron: string;
  schedule_label: string;
  format: string;
  recipients: Array<{ email: string; name: string }>;
  scope_filter?: Record<string, unknown>;
}

interface UpdateScheduledReportInput extends Partial<CreateScheduledReportInput> {
  id: string;
}

/**
 * Fetch all scheduled reports for the authenticated host
 */
export async function fetchScheduledReportsAction() {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return {
      success: false,
      error: "Host not found",
    };
  }

  // Fetch scheduled reports
  const { data, error } = await supabase
    .from("scheduled_reports")
    .select("*")
    .eq("host_id", host.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch scheduled reports:", error);
    return {
      success: false,
      error: "Failed to fetch scheduled reports",
    };
  }

  return {
    success: true,
    data: data || [],
  };
}

/**
 * Create a new scheduled report
 */
export async function createScheduledReportAction(input: CreateScheduledReportInput) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return {
      success: false,
      error: "Host not found",
    };
  }

  // Calculate next_run_at based on cron expression
  const nextRunAt = calculateNextRun(input.schedule_cron);

  // Insert scheduled report
  const { data, error } = await supabase
    .from("scheduled_reports")
    .insert({
      host_id: host.id,
      name: input.name,
      description: input.description || null,
      report_type: input.report_type,
      schedule_cron: input.schedule_cron,
      schedule_label: input.schedule_label,
      format: input.format,
      recipients: input.recipients,
      scope_filter: input.scope_filter || {},
      is_active: true,
      next_run_at: nextRunAt,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create scheduled report:", error);
    return {
      success: false,
      error: "Failed to create scheduled report",
    };
  }

  revalidatePath("/dashboard/reports");

  return {
    success: true,
    data,
  };
}

/**
 * Update an existing scheduled report
 */
export async function updateScheduledReportAction(input: UpdateScheduledReportInput) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return {
      success: false,
      error: "Host not found",
    };
  }

  // Build update object (only include provided fields)
  const updateData: Record<string, unknown> = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.report_type !== undefined) updateData.report_type = input.report_type;
  if (input.format !== undefined) updateData.format = input.format;
  if (input.recipients !== undefined) updateData.recipients = input.recipients;
  if (input.scope_filter !== undefined) updateData.scope_filter = input.scope_filter;

  if (input.schedule_cron !== undefined) {
    updateData.schedule_cron = input.schedule_cron;
    updateData.next_run_at = calculateNextRun(input.schedule_cron);
  }

  if (input.schedule_label !== undefined) {
    updateData.schedule_label = input.schedule_label;
  }

  // Update scheduled report
  const { data, error } = await supabase
    .from("scheduled_reports")
    .update(updateData)
    .eq("id", input.id)
    .eq("host_id", host.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update scheduled report:", error);
    return {
      success: false,
      error: "Failed to update scheduled report",
    };
  }

  revalidatePath("/dashboard/reports");

  return {
    success: true,
    data,
  };
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReportAction(reportId: string) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return {
      success: false,
      error: "Host not found",
    };
  }

  // Delete scheduled report
  const { error } = await supabase
    .from("scheduled_reports")
    .delete()
    .eq("id", reportId)
    .eq("host_id", host.id);

  if (error) {
    console.error("Failed to delete scheduled report:", error);
    return {
      success: false,
      error: "Failed to delete scheduled report",
    };
  }

  revalidatePath("/dashboard/reports");

  return {
    success: true,
  };
}

/**
 * Toggle the active status of a scheduled report
 */
export async function toggleScheduledReportActiveAction(reportId: string, isActive: boolean) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get host
  const { data: host } = await supabase
    .from("hosts")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!host) {
    return {
      success: false,
      error: "Host not found",
    };
  }

  // Update is_active status
  const { data, error } = await supabase
    .from("scheduled_reports")
    .update({ is_active: isActive })
    .eq("id", reportId)
    .eq("host_id", host.id)
    .select()
    .single();

  if (error) {
    console.error("Failed to toggle scheduled report status:", error);
    return {
      success: false,
      error: "Failed to update report status",
    };
  }

  revalidatePath("/dashboard/reports");

  return {
    success: true,
    data,
  };
}

/**
 * Calculate next run time based on cron expression
 * This is a simplified implementation - in production you'd use a proper cron parser
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateNextRun(_cronExpression: string): string {
  // For now, just add 1 day to current time
  // TODO: Implement proper cron parsing (or use a library like node-cron)
  const now = new Date();
  now.setDate(now.getDate() + 1);
  now.setHours(8, 0, 0, 0); // Default to 8 AM
  return now.toISOString();
}
