// crypto.randomUUID() only exists in a secure context (https or localhost). On
// a plain-http LAN origin (e.g. testing on a phone via http://192.168.x.x) it's
// undefined and throws — which would silently break uploads. Fall back safely.
export function randomId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
