import ExcelJS from "exceljs";

import type { ReportData } from "./pdf";

export async function generateXLSX(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Wielo Analytics";
  workbook.created = new Date();
  workbook.modified = new Date();

  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FF10B981" },
  };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };

  // ── Sheet 1: Summary (headline KPIs + channels + funnel + LF) ──────────────
  const s = data.summary;
  if (s || (data.channels && data.channels.length > 0) || data.funnel) {
    const sum = workbook.addWorksheet("Summary");
    sum.getColumn(1).width = 30;
    sum.getColumn(2).width = 22;

    sum.mergeCells("A1:B1");
    const t = sum.getCell("A1");
    t.value = `Wielo Analytics — ${data.hostName}`;
    t.font = { bold: true, size: 14 };
    sum.mergeCells("A2:B2");
    const p = sum.getCell("A2");
    p.value = `Period: ${data.startDate} to ${data.endDate}`;
    p.font = { italic: true, size: 10 };

    let r = 4;
    const section = (label: string) => {
      const c = sum.getCell(`A${r}`);
      c.value = label;
      c.font = { bold: true, color: { argb: "FF064E3B" }, size: 11 };
      r += 1;
    };
    const kv = (label: string, value: string | number, fmt?: string) => {
      sum.getCell(`A${r}`).value = label;
      const vc = sum.getCell(`B${r}`);
      vc.value = value;
      if (fmt && typeof value === "number") vc.numFmt = fmt;
      r += 1;
    };

    if (s) {
      section("Headline performance");
      kv("Total revenue", s.revenue, "R #,##0");
      kv("Revenue (prior period)", s.revenuePrior, "R #,##0");
      kv(
        "Revenue change %",
        s.revenueDelta !== null ? s.revenueDelta / 100 : "N/A",
        "0.0%",
      );
      kv("RevPAR", s.revpar, "R #,##0");
      kv("ADR", s.adr, "R #,##0");
      kv("Occupancy %", s.occupancy / 100, "0.0%");
      kv("Occupied nights", s.occupiedNights);
      kv("Available nights", s.availableNights);
      kv("Net value (after refunds)", s.netValue, "R #,##0");
      kv("Commission saved vs OTAs", s.commissionSaved, "R #,##0");
      kv("Average rating", s.reviewCount > 0 ? s.avgRating : "N/A");
      kv("Review count", s.reviewCount);
      kv("Total bookings", s.totalBookings);
      kv("Cancellations", s.cancellationCount);
      kv("Cancellation rate %", s.cancellationRate / 100, "0.0%");
      kv("Refund amount", s.refundAmount, "R #,##0");
      kv("Refund count", s.refundCount);
      kv("Quotes sent", s.quotesSent);
      kv("Quotes accepted", s.quotesAccepted);
      kv("Acceptance rate %", s.acceptanceRate / 100, "0.0%");
      kv("Listing views", s.listingViews);
      r += 1;
    }

    if (data.channels && data.channels.length > 0) {
      section("Channel mix");
      for (const c of data.channels) {
        kv(channelName(c.channel), c.revenue, "R #,##0");
      }
      r += 1;
    }

    if (data.funnel) {
      section("Conversion funnel");
      kv("Views", data.funnel.views);
      kv("Inquiries", data.funnel.inquiries);
      kv("Quotes", data.funnel.quotes);
      kv("Bookings", data.funnel.bookings);
      r += 1;
    }

    if (data.lookingFor && data.lookingFor.quotesSent > 0) {
      section("Looking For");
      kv("Quotes sent", data.lookingFor.quotesSent);
      kv("Quotes accepted", data.lookingFor.quotesAccepted);
      kv("Acceptance rate %", data.lookingFor.acceptanceRate / 100, "0.0%");
      kv("Revenue", data.lookingFor.revenue, "R #,##0");
    }
  }

  // ── Sheet 2: Property Performance ─────────────────────────────────────────
  const sheet = workbook.addWorksheet("Property Performance");

  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Property Performance Report - ${data.hostName}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 25;

  sheet.mergeCells("A2:K2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `Period: ${data.startDate} to ${data.endDate}`;
  dateCell.font = { italic: true, size: 10 };
  dateCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 20;

  sheet.getRow(3).height = 10;

  const headers = [
    "Property",
    "Status",
    "Revenue (Current)",
    "Revenue (Prior)",
    "Revenue Change %",
    "Nights Booked",
    "Occupancy % (Current)",
    "Occupancy % (Prior)",
    "Occupancy Change %",
    "ADR",
    "Bookings",
  ];

  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  });
  headerRow.height = 20;

  data.properties.forEach((property, index) => {
    const row = sheet.getRow(5 + index);

    row.getCell(1).value = property.listing_name;
    row.getCell(2).value = property.listing_status;
    row.getCell(3).value = property.revenue;
    row.getCell(4).value = property.revenue_prior;
    row.getCell(5).value =
      property.revenue_delta !== null ? property.revenue_delta : "N/A";
    row.getCell(6).value = property.nights_booked;
    row.getCell(7).value = property.occupancy;
    row.getCell(8).value = property.occupancy_prior;
    row.getCell(9).value =
      property.occupancy_delta !== null ? property.occupancy_delta : "N/A";
    row.getCell(10).value = property.adr;
    row.getCell(11).value = property.bookings_count;

    row.getCell(3).numFmt = "R #,##0.00";
    row.getCell(4).numFmt = "R #,##0.00";
    row.getCell(10).numFmt = "R #,##0.00";

    if (typeof row.getCell(5).value === "number") {
      row.getCell(5).numFmt = "0.0";
    }
    if (typeof row.getCell(9).value === "number") {
      row.getCell(9).numFmt = "0.0";
    }

    if (index % 2 === 0) {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }

    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  sheet.getColumn(1).width = 25;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 16;
  sheet.getColumn(5).width = 16;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 18;
  sheet.getColumn(8).width = 18;
  sheet.getColumn(9).width = 18;
  sheet.getColumn(10).width = 12;
  sheet.getColumn(11).width = 12;

  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function channelName(channel: string): string {
  const map: Record<string, string> = {
    direct: "Wielo",
    wielo: "Wielo",
    vilo: "Wielo",
    website: "Website",
    "web-referred": "Web referral",
    airbnb: "Airbnb",
    booking: "Booking.com",
    "booking.com": "Booking.com",
    expedia: "Expedia",
    lekkerslaap: "LekkerSlaap",
    other: "Other",
  };
  const k = channel.toLowerCase();
  return map[k] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}
