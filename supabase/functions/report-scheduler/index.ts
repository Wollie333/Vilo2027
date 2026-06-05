import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledReport {
  id: string;
  host_id: string;
  name: string;
  description: string | null;
  report_type: string;
  format: string;
  recipients: Array<{ email: string; name: string }>;
  scope_filter: Record<string, unknown>;
  schedule_cron: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("report-scheduler: Starting scheduled report check...");

    // Fetch all active reports that are due to run (next_run_at <= now)
    const now = new Date().toISOString();
    const { data: dueReports, error: fetchError } = await supabase
      .from("scheduled_reports")
      .select("*")
      .eq("is_active", true)
      .lte("next_run_at", now)
      .order("next_run_at", { ascending: true });

    if (fetchError) {
      console.error("Failed to fetch due reports:", fetchError);
      throw new Error(`Failed to fetch due reports: ${fetchError.message}`);
    }

    console.log(`Found ${dueReports?.length || 0} due reports`);

    if (!dueReports || dueReports.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No reports due",
          processedCount: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Process each due report
    const results = await Promise.allSettled(
      dueReports.map((report) => processScheduledReport(supabase, report))
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;
    const failedCount = results.filter((r) => r.status === "rejected").length;

    console.log(`Processed ${successCount} reports successfully, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${dueReports.length} reports`,
        successCount,
        failedCount,
        results: results.map((r, i) => ({
          reportId: dueReports[i].id,
          status: r.status,
          error: r.status === "rejected" ? r.reason?.message : undefined,
        })),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("report-scheduler error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

/**
 * Process a single scheduled report
 */
async function processScheduledReport(supabase: any, report: ScheduledReport) {
  console.log(`Processing report: ${report.id} - ${report.name}`);

  // Create report_runs entry (status: processing)
  const { data: reportRun, error: createRunError } = await supabase
    .from("report_runs")
    .insert({
      scheduled_report_id: report.id,
      host_id: report.host_id,
      report_type: report.report_type,
      scope_filter: report.scope_filter,
      format: report.format,
      status: "processing",
    })
    .select()
    .single();

  if (createRunError) {
    console.error(`Failed to create report_run for ${report.id}:`, createRunError);
    throw new Error(`Failed to create report_run: ${createRunError.message}`);
  }

  try {
    // Generate report data
    console.log(`Generating ${report.format.toUpperCase()} report for ${report.report_type}`);

    // TODO: Implement actual report generation based on report_type
    // For now, create a placeholder
    const reportContent = `Report: ${report.name}\nType: ${report.report_type}\nGenerated: ${new Date().toISOString()}`;
    const fileName = `${report.report_type}_${new Date().toISOString().split("T")[0]}.txt`;

    // Upload to Supabase Storage
    const storagePath = `${report.host_id}/${reportRun.id}_${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("reports")
      .upload(storagePath, reportContent, {
        contentType: "text/plain",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload report to storage:", uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Generate signed URL (7-day expiration)
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from("reports")
      .createSignedUrl(storagePath, 604800); // 7 days in seconds

    if (urlError) {
      console.error("Failed to generate signed URL:", urlError);
      throw new Error(`Failed to generate signed URL: ${urlError.message}`);
    }

    const signedUrl = signedUrlData.signedUrl;

    // Send email to recipients
    // TODO: Integrate with Resend via Edge Function
    console.log(`Would send email to ${report.recipients.length} recipients`);
    console.log(`Download URL: ${signedUrl}`);

    // Update report_runs (status: completed)
    await supabase
      .from("report_runs")
      .update({
        status: "completed",
        file_storage_path: storagePath,
        file_url: signedUrl,
        completed_at: new Date().toISOString(),
      })
      .eq("id", reportRun.id);

    // Update scheduled_reports (last_run_at, next_run_at)
    const nextRunAt = calculateNextRun(report.schedule_cron || "0 8 * * *");
    await supabase
      .from("scheduled_reports")
      .update({
        last_run_at: new Date().toISOString(),
        next_run_at: nextRunAt,
      })
      .eq("id", report.id);

    console.log(`Report ${report.id} processed successfully. Next run: ${nextRunAt}`);

    return {
      success: true,
      reportId: report.id,
      fileUrl: signedUrl,
    };
  } catch (error) {
    // Update report_runs (status: failed)
    await supabase
      .from("report_runs")
      .update({
        status: "failed",
        error_message: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", reportRun.id);

    console.error(`Failed to process report ${report.id}:`, error);
    throw error;
  }
}

/**
 * Calculate next run time based on cron expression
 * Simplified implementation - in production use a proper cron parser
 */
function calculateNextRun(cronExpression: string): string {
  // For now, just add 1 day
  // TODO: Use proper cron parser (e.g., cronstrue or cron-parser)
  const now = new Date();
  now.setDate(now.getDate() + 1);
  now.setHours(8, 0, 0, 0); // Default to 8 AM
  return now.toISOString();
}
