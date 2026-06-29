import ExcelJS from "exceljs";

interface PropertyPerformanceRow {
  listing_name: string;
  listing_status: string;
  revenue: number;
  revenue_prior: number;
  revenue_delta: number | null;
  nights_booked: number;
  occupancy: number;
  occupancy_prior: number;
  occupancy_delta: number | null;
  adr: number;
  bookings_count: number;
}

interface ReportData {
  properties: PropertyPerformanceRow[];
  startDate: string;
  endDate: string;
  hostName: string;
}

export async function generateXLSX(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Metadata
  workbook.creator = "Wielo Analytics";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Sheet 1: Property Performance
  const sheet = workbook.addWorksheet("Property Performance");

  // Header styling
  const headerFill = {
    type: "pattern" as const,
    pattern: "solid" as const,
    fgColor: { argb: "FF10B981" },
  };

  const headerFont = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
  };

  // Title row
  sheet.mergeCells("A1:K1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = `Property Performance Report - ${data.hostName}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 25;

  // Date range row
  sheet.mergeCells("A2:K2");
  const dateCell = sheet.getCell("A2");
  dateCell.value = `Period: ${data.startDate} to ${data.endDate}`;
  dateCell.font = { italic: true, size: 10 };
  dateCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 20;

  // Empty row
  sheet.getRow(3).height = 10;

  // Column headers
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

  // Data rows
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

    // Format currency cells
    row.getCell(3).numFmt = "R #,##0.00";
    row.getCell(4).numFmt = "R #,##0.00";
    row.getCell(10).numFmt = "R #,##0.00";

    // Format percentage cells
    if (typeof row.getCell(5).value === "number") {
      row.getCell(5).numFmt = "0.0%";
    }
    row.getCell(7).numFmt = "0.0%";
    row.getCell(8).numFmt = "0.0%";
    if (typeof row.getCell(9).value === "number") {
      row.getCell(9).numFmt = "0.0%";
    }

    // Alternating row colors
    if (index % 2 === 0) {
      row.eachCell({ includeEmpty: false }, (cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FAFB" },
        };
      });
    }

    // Borders
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  // Column widths
  sheet.getColumn(1).width = 25; // Property
  sheet.getColumn(2).width = 12; // Status
  sheet.getColumn(3).width = 16; // Revenue (Current)
  sheet.getColumn(4).width = 16; // Revenue (Prior)
  sheet.getColumn(5).width = 16; // Revenue Change %
  sheet.getColumn(6).width = 14; // Nights Booked
  sheet.getColumn(7).width = 18; // Occupancy % (Current)
  sheet.getColumn(8).width = 18; // Occupancy % (Prior)
  sheet.getColumn(9).width = 18; // Occupancy Change %
  sheet.getColumn(10).width = 12; // ADR
  sheet.getColumn(11).width = 12; // Bookings

  // Freeze header rows
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
