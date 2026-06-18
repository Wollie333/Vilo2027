// Cross-platform build wrapper: runs `next build` with a larger V8 heap so the
// build worker doesn't OOM-crash (exit 134) on memory-tighter machines. No new
// dependency (avoids needing cross-env for Windows). Appending our flag to any
// existing NODE_OPTIONS is safe — Node takes the last --max-old-space-size.
import { spawnSync } from "node:child_process";

const HEAP = "--max-old-space-size=6144";
const existing = process.env.NODE_OPTIONS ?? "";
const NODE_OPTIONS = existing.includes("--max-old-space-size")
  ? existing
  : `${existing} ${HEAP}`.trim();

const result = spawnSync("next", ["build", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NODE_OPTIONS },
});

process.exit(result.status ?? 1);
