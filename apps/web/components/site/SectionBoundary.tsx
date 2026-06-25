"use client";

import { Component, type ReactNode } from "react";

/**
 * Per-section error boundary. A single section that throws at render time must
 * never take down the whole page — on the public site we silently omit it (the
 * page stays up); in the builder we show a compact, fixable notice instead.
 *
 * `resetKey` is the section object: editing that section produces a new
 * reference, which clears the caught error so the fixed section re-renders.
 */
export class SectionBoundary extends Component<
  { children: ReactNode; resetKey: unknown; fallbackLabel?: string },
  { failed: boolean; lastKey: unknown }
> {
  constructor(props: {
    children: ReactNode;
    resetKey: unknown;
    fallbackLabel?: string;
  }) {
    super(props);
    this.state = { failed: false, lastKey: props.resetKey };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey: unknown },
    state: { failed: boolean; lastKey: unknown },
  ) {
    // The section changed (e.g. the host edited it) — retry rendering it.
    if (props.resetKey !== state.lastKey) {
      return { failed: false, lastKey: props.resetKey };
    }
    return null;
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // No label (public site) → omit the broken section entirely.
    if (!this.props.fallbackLabel) return null;
    return (
      <div
        role="alert"
        className="mx-auto my-4 max-w-3xl rounded-lg border border-dashed border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {this.props.fallbackLabel}
      </div>
    );
  }
}
