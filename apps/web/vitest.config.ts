import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit + integration tests (Vitest) per TESTING.md. The pricing engine is pure
// TS, so the default node environment is enough. `@/` mirrors the Next alias.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws by design when imported outside a React Server
      // Component, which makes every module that guards itself with it
      // untestable. Stub it so server-side logic can be unit tested — the guard
      // still does its real job in the Next build, which is where it matters.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
