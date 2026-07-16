import { describe, it, expect } from "vitest";

import {
  AiError,
  AiUnavailableError,
  aiConfigured,
  generateJson,
  type GenerateJsonInput,
} from "./client";

function resp(init: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}): Response {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    json: async () => init.json,
    text: async () => init.text ?? "",
  } as unknown as Response;
}

const BASE: GenerateJsonInput = {
  prompt: "hello",
  jsonSchema: { type: "object", properties: { v: { type: "string" } } },
  toolName: "emit_result",
};

describe("generateJson", () => {
  it("throws AiUnavailableError when no API key is set", async () => {
    await expect(
      generateJson(BASE, {
        apiKey: undefined,
        fetchImpl: async () => resp({ ok: true }),
      }),
    ).rejects.toBeInstanceOf(AiUnavailableError);
  });

  it("returns the forced tool's input on success", async () => {
    const out = await generateJson(BASE, {
      apiKey: "k",
      fetchImpl: async () =>
        resp({
          ok: true,
          json: {
            content: [
              { type: "text", text: "ignore me" },
              { type: "tool_use", name: "emit_result", input: { v: "hi" } },
            ],
          },
        }),
    });
    expect(out).toEqual({ v: "hi" });
  });

  it("sends a forced tool_choice and the chosen model", async () => {
    let sentBody: Record<string, unknown> = {};
    await generateJson(
      { ...BASE, tier: "fast" },
      {
        apiKey: "k",
        models: { fast: "test-haiku" },
        fetchImpl: async (_url, init) => {
          sentBody = JSON.parse(String(init?.body));
          return resp({
            ok: true,
            json: {
              content: [{ type: "tool_use", name: "emit_result", input: {} }],
            },
          });
        },
      },
    );
    expect(sentBody.model).toBe("test-haiku");
    expect(sentBody.tool_choice).toEqual({ type: "tool", name: "emit_result" });
    expect(Array.isArray(sentBody.tools)).toBe(true);
  });

  it("throws AiError on a non-OK response", async () => {
    await expect(
      generateJson(BASE, {
        apiKey: "k",
        fetchImpl: async () =>
          resp({ ok: false, status: 429, text: "rate limit" }),
      }),
    ).rejects.toBeInstanceOf(AiError);
  });

  it("throws AiError when the response has no tool_use block", async () => {
    await expect(
      generateJson(BASE, {
        apiKey: "k",
        fetchImpl: async () =>
          resp({
            ok: true,
            json: { content: [{ type: "text", text: "no tool" }] },
          }),
      }),
    ).rejects.toBeInstanceOf(AiError);
  });
});

describe("aiConfigured", () => {
  it("reflects whether an API key is available", () => {
    expect(aiConfigured({ apiKey: "k" })).toBe(true);
    expect(aiConfigured({ apiKey: undefined })).toBe(
      Boolean(process.env.ANTHROPIC_API_KEY),
    );
  });
});
