import type { ReactNode } from "react";

import type { SystemPageStyleNode } from "@/lib/site/systemPageStyle";

import {
  blockFrameStyle,
  customCssScoped,
  deviceHideCss,
  elementVarsCss,
} from "./sections/_shared";

// Builder V3 — apply a system page's saved styling around a DEDICATED live route.
//
// Wraps the real (unchanged) SiteCheckoutForm / confirmation in the same scoped
// styling the builder canvas applies to a `booking_form` / `booking_confirmation`
// node: the block frame (bg/border/radius/max-width from `node.style`), the
// per-element `--el-<key>-*` custom properties (set on this wrapper so they
// cascade), the host's custom CSS, and per-device visibility — all via the shared
// `_shared.tsx` helpers, so canvas and live never diverge. When there's no saved
// node it renders children unchanged (checkout must never depend on this).
export function BookingStyleOverlay({
  node,
  sectionType,
  children,
}: {
  node: SystemPageStyleNode | null;
  /** Stable skin hook (`booking_form` / `booking_confirmation`). */
  sectionType: string;
  children: ReactNode;
}) {
  if (!node) return <>{children}</>;
  const sel = `[data-node-id="${node.id}"]`;
  const css =
    elementVarsCss(sel, node) +
    deviceHideCss(sel, node) +
    customCssScoped(sel, node.customCss);
  const frame = blockFrameStyle(node.style);
  const hasFrame = Object.keys(frame).length > 0;
  if (!css && !hasFrame) return <>{children}</>;
  return (
    <div
      data-node-id={node.id}
      data-section-type={sectionType}
      style={hasFrame ? frame : undefined}
    >
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {children}
    </div>
  );
}
