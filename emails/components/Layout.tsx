import * as React from "react";

import Shell from "./Shell";

type Props = {
  /** Renders in the email client preview pane. Keep under 90 chars. */
  preview: string;
  children: React.ReactNode;
};

// Legacy layout kept for the many templates that place their own <Heading> in
// the body. It now delegates to the canonical Shell so EVERY Wielo email shares
// one design system — the dark brand header band, green accent line, and
// branded footer used by the Looking-For / quote emails. Templates that pass a
// structured title/eyebrow/pill should use Shell directly; this wrapper simply
// renders the shared chrome around their existing body.
export default function Layout({ preview, children }: Props) {
  return <Shell preview={preview}>{children}</Shell>;
}
