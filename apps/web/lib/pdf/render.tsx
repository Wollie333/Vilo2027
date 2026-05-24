import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { InvoiceDocument, type InvoiceProps } from "./InvoiceDocument";
import { QuoteDocument, type QuoteProps } from "./QuoteDocument";

export async function renderInvoicePdf(invoice: InvoiceProps): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}

export async function renderQuotePdf(quote: QuoteProps): Promise<Buffer> {
  return renderToBuffer(<QuoteDocument quote={quote} />);
}
