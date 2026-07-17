#!/usr/bin/env bash
# Build / refresh the local graphify code knowledge graph.
#
# AST-only, fully local, no API cost, ~45s on this repo. Query it instead of
# grepping across files when orienting or tracing impact:
#
#   graphify explain "loadActiveThemes"     # file+line, callers, callees, SQL FKs
#   graphify path "A" "B"                    # shortest connection between two nodes
#
# graphify-out/ is gitignored — rebuild per session with this script.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"

if ! command -v graphify >/dev/null 2>&1; then
  echo "Installing graphify (with SQL grammar)…"
  pip install --quiet --break-system-packages "graphifyy[sql]" \
    || pipx install "graphifyy[sql]"
fi

echo "Building code graph for $ROOT (respects .gitignore + .graphifyignore)…"
graphify update "$ROOT" --no-cluster

echo "✓ graph ready: $ROOT/graphify-out/graph.json"
echo "  try:  graphify explain \"loadActiveThemes\"   |   graphify path \"A\" \"B\""
