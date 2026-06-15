import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { CreditNoteDocument, type CreditNoteProps } from "./CreditNoteDocument";
import { InvoiceDocument, type InvoiceProps } from "./InvoiceDocument";
import {
  PlatformReportDocument,
  type PlatformReportProps,
} from "./PlatformReportDocument";
import { QuoteDocument, type QuoteProps } from "./QuoteDocument";
import { ReceiptDocument, type ReceiptProps } from "./ReceiptDocument";

export async function renderInvoicePdf(invoice: InvoiceProps): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}

export async function renderQuotePdf(quote: QuoteProps): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument quote={quote} />);
}

export async function renderCreditNotePdf(
  note: CreditNoteProps,
): Promise<Buffer> {
  return renderToBuffer(<CreditNoteDocument note={note} />);
}

export async function renderReceiptPdf(receipt: ReceiptProps): Promise<Buffer> {
  return renderToBuffer(<ReceiptDocument receipt={receipt} />);
}

export async function renderPlatformReportPdf(
  props: PlatformReportProps,
): Promise<Buffer> {
  return renderToBuffer(<PlatformReportDocument {...props} />);
}
