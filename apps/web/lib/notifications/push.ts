import type { PushPayload } from "./types";

// Expo Push API direct HTTP client — no expo-server-sdk dep.
// https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;
const TOKEN_PATTERN = /^Expo(nent)?PushToken\[.+\]$/;

export function isExpoPushToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

type ExpoMessage = PushPayload & { to: string };

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: Record<string, unknown> };

export type SendResult = {
  attempted: number;
  ok: number;
  failed: number;
  errors: string[];
};

export async function sendPushToTokens(
  tokens: string[],
  payload: PushPayload,
): Promise<SendResult> {
  const valid = tokens.filter(isExpoPushToken);
  const result: SendResult = {
    attempted: valid.length,
    ok: 0,
    failed: 0,
    errors: [],
  };
  if (valid.length === 0) return result;

  const messages: ExpoMessage[] = valid.map((to) => ({ ...payload, to }));

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch(EXPO_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(chunk),
      });
      if (!response.ok) {
        result.failed += chunk.length;
        result.errors.push(`http_${response.status}`);
        continue;
      }
      const json = (await response.json()) as { data?: ExpoTicket[] };
      const tickets = json.data ?? [];
      tickets.forEach((ticket) => {
        if (ticket.status === "ok") {
          result.ok += 1;
        } else {
          result.failed += 1;
          result.errors.push(ticket.message);
        }
      });
    } catch (err) {
      result.failed += chunk.length;
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return result;
}
