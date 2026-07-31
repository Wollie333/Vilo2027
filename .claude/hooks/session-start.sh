#!/bin/bash
# SessionStart hook — make Claude Code on the web sessions able to build, lint,
# generate types, and run SQL/migrations, on ANY branch.
#
# Installs: pnpm deps + the Supabase CLI, then links the project so `supabase`
# commands target it. With Supabase Branching enabled (see
# docs/legal/SUPABASE_BRANCHING_SETUP.md), migrations auto-apply to each git
# branch's own preview database — so running SQL on a sub-branch never touches
# production.
#
# Idempotent and non-interactive. Web-only (local devs manage their own stack).
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# ── 1. Node dependencies (pnpm) ──────────────────────────────────────
# Container state is cached after the hook, so a plain install is fine and fast
# on resume. Fall back to a non-frozen install if the lockfile drifts.
corepack enable >/dev/null 2>&1 || true
echo "hook: installing pnpm dependencies…"
pnpm install --frozen-lockfile >/tmp/pnpm-install.log 2>&1 \
  || pnpm install >/tmp/pnpm-install.log 2>&1 \
  || { echo "hook: pnpm install FAILED"; tail -30 /tmp/pnpm-install.log; exit 1; }
echo "hook: pnpm dependencies ready."

# ── 2. Supabase CLI ──────────────────────────────────────────────────
# Needed for: supabase db push / gen types / migration new / db diff / branches.
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v supabase >/dev/null 2>&1; then
  echo "hook: installing Supabase CLI…"
  case "$(uname -m)" in
    x86_64) SBARCH=amd64 ;;
    aarch64 | arm64) SBARCH=arm64 ;;
    *) SBARCH=amd64 ;;
  esac
  # Resolve the latest linux asset URL from the GitHub API (asset name embeds the
  # version, so we can't hardcode a "latest/download/<name>" path).
  SB_URL="$(curl -fsSL https://api.github.com/repos/supabase/cli/releases/latest \
    | grep -o "https://[^\"]*linux_${SBARCH}\.tar\.gz" | head -1 || true)"
  if [ -n "${SB_URL}" ] && curl -fsSL "${SB_URL}" -o /tmp/supabase.tar.gz; then
    tar -xzf /tmp/supabase.tar.gz -C "$HOME/.local/bin" supabase \
      && chmod +x "$HOME/.local/bin/supabase" \
      && echo "hook: Supabase CLI installed ($("$HOME/.local/bin/supabase" --version 2>/dev/null || echo unknown))"
  else
    echo "hook: could not download Supabase CLI (network policy?) — skipping."
  fi
fi
# Persist PATH for the whole session so `supabase` resolves in later commands.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
fi

# ── 3. Link the Supabase project ─────────────────────────────────────
# Requires SUPABASE_ACCESS_TOKEN (add it as an environment secret). Optional
# SUPABASE_DB_PASSWORD lets `supabase db push --linked` run non-interactively.
# Skips quietly when the token is absent so the hook never blocks a session.
PROJECT_REF="zlcivjgvtyeaszikqleu"
if command -v supabase >/dev/null 2>&1 && [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  if supabase link --project-ref "$PROJECT_REF" \
       ${SUPABASE_DB_PASSWORD:+--password "$SUPABASE_DB_PASSWORD"} >/tmp/supabase-link.log 2>&1; then
    echo "hook: supabase linked to $PROJECT_REF."
  else
    echo "hook: supabase link failed — check SUPABASE_ACCESS_TOKEN and network policy:"
    tail -8 /tmp/supabase-link.log
  fi
else
  echo "hook: Supabase CLI ready. Set SUPABASE_ACCESS_TOKEN (env secret) to auto-link."
fi

echo "hook: session setup complete."
