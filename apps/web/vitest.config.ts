import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit + integration tests (Vitest) per TESTING.md. The pricing engine is pure
// TS, so the default node environment is enough. `@/` mirrors the Next alias.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
});
