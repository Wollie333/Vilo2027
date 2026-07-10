import { createElement } from "react";
import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { EMAIL_REGISTRY } from "@/lib/email/registry";

import { getSamplePayload } from "./samplePayloads";

// Guards the admin email preview/test-send tool (/admin/emails/[type]): every
// registered template must render to non-empty HTML with its sample payload —
// exactly what renderPreviewAction does. A template that throws or renders
// empty means a broken (unsendable) email in production.

const types = Object.keys(EMAIL_REGISTRY);

describe("email registry", () => {
  it("registers the full template set", () => {
    expect(types.length).toBeGreaterThanOrEqual(26);
  });

  it.each(types)(
    "renders %s to non-empty HTML with sample payload",
    async (type) => {
      const entry = EMAIL_REGISTRY[type];
      const payload = getSamplePayload(type);

      const html = await render(createElement(entry.Template, payload));
      expect(typeof html).toBe("string");
      expect(html.length).toBeGreaterThan(50);

      // subject() must not throw and must return a string for any payload.
      expect(typeof entry.subject(payload)).toBe("string");
    },
  );
});
