import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/admin";
import {
  buildPlatformReport,
  isReportRange,
  type ReportRange,
} from "@/lib/billing/platform-report";
import { getBrandName } from "@/lib/brand";
import { renderPlatformReportPdf } from "@/lib/pdf/render";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requirePermission("subscriptions.edit");

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("range") ?? undefined;
  const range: ReportRange = isReportRange(rangeParam ?? undefined)
    ? (rangeParam as ReportRange)
    : "12m";

  const [report, brandName] = await Promise.all([
    buildPlatformReport(range),
    getBrandName(),
  ]);

  const buffer = await renderPlatformReportPdf({ report, brandName });
  const stamp = report.generatedAt.slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${brandName}-report-${range}-${stamp}.pdf"`,
    },
  });
}
