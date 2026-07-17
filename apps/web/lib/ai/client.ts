// Provider-agnostic structured-output AI client.
//
// Wizard arc slice 3. Currently backed by Anthropic (Claude), called over plain
// `fetch` (no SDK dependency). Two tiers:
//   • "quality" → Sonnet — the one-shot "Build my site" generation.
//   • "fast"    → Haiku  — per-section regenerates + small rewrites.
//
// Structured output is obtained via a single FORCED tool call whose
// `input_schema` is the caller's JSON Schema, so the model must return a valid
// object (the caller then validates it with Zod). Inert until ANTHROPIC_API_KEY
// is set. Model IDs are env-overridable so ops can pin the current Claude
// versions without a code change.

export type AiTier = "quality" | "fast";

export type GenerateJsonInput = {
  system?: string;
  prompt: string;
  tier?: AiTier;
  /** JSON Schema for the structured result (the forced tool's input_schema). */
  jsonSchema: Record<string, unknown>;
  toolName?: string;
  toolDescription?: string;
  maxTokens?: number;
};

/** Injectable dependencies (for tests + overrides). */
export type AiDeps = {
  fetchImpl?: typeof fetch;
  apiKey?: string;
  models?: Partial<Record<AiTier, string>>;
};

/** Default model per tier — override via env to pin current Claude versions.
 *  The old `claude-3-5-…-latest` ids were RETIRED (the API returns 404
 *  "model: claude-3-5-sonnet-latest"), so these default to current models.
 *  Note: from the 4.6 generation on, Claude model ids are dateless pinned
 *  snapshots (no `-latest` aliases). Bump these (or set the env vars) when
 *  newer versions ship. */
function defaultModel(tier: AiTier): string {
  if (tier === "fast") {
    return process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5";
  }
  return process.env.ANTHROPIC_MODEL_QUALITY ?? "claude-sonnet-5";
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/** The AI backend is not configured (no API key) — the feature stays inert. */
export class AiUnavailableError extends Error {
  constructor(message = "AI is not configured") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** The AI request failed (network, API error, or an unusable response). */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiError";
  }
}

/** True when the AI backend is configured (API key present). */
export function aiConfigured(deps: AiDeps = {}): boolean {
  return Boolean(deps.apiKey ?? process.env.ANTHROPIC_API_KEY);
}

/**
 * Ask the model for a structured JSON result. Returns the raw tool input (the
 * caller validates it with a Zod schema). Throws AiUnavailableError when no key
 * is set, or AiError on any request/response failure.
 */
export async function generateJson(
  input: GenerateJsonInput,
  deps: AiDeps = {},
): Promise<unknown> {
  const apiKey = deps.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AiUnavailableError();

  const doFetch = deps.fetchImpl ?? fetch;
  const tier = input.tier ?? "quality";
  const model = deps.models?.[tier] ?? defaultModel(tier);
  const toolName = input.toolName ?? "emit_result";

  let res: Response;
  try {
    res = await doFetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens ?? 1500,
        ...(input.system ? { system: input.system } : {}),
        messages: [{ role: "user", content: input.prompt }],
        tools: [
          {
            name: toolName,
            description:
              input.toolDescription ?? "Return the structured result.",
            input_schema: input.jsonSchema,
          },
        ],
        tool_choice: { type: "tool", name: toolName },
      }),
    });
  } catch (err) {
    throw new AiError(
      `AI request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiError(
      `Anthropic API error ${res.status}: ${body.slice(0, 500)}`,
    );
  }

  const data = (await res.json().catch(() => null)) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  } | null;

  const toolUse = data?.content?.find(
    (b) => b.type === "tool_use" && b.name === toolName,
  );
  if (!toolUse || toolUse.input === undefined) {
    throw new AiError("Anthropic response contained no tool_use result");
  }
  return toolUse.input;
}
