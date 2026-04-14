#!/usr/bin/env bash
# install.sh — Installs PlugVault skill files into ~/.claude/
# Works on macOS, Linux, and Windows Git Bash (POSIX-compatible)

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_SKILL="$HOME/.claude/skills/plug"
DEST_REFS="$HOME/.claude/skills/plug/references"
DEST_CMDS="$HOME/.claude/commands"

# ── Helpers ────────────────────────────────────────────────────────────────────
installed=()
overwritten=()

copy_file() {
  local src="$1"
  local dst="$2"

  if [ -e "$dst" ]; then
    echo "  [WARN] Overwriting existing file: $dst"
    overwritten+=("$dst")
  fi

  cp "$src" "$dst"
  installed+=("$dst")
  echo "  [OK]   $dst"
}

# ── Create directories ─────────────────────────────────────────────────────────
echo ""
echo "==> Creating directories..."
mkdir -p "$DEST_SKILL"
mkdir -p "$DEST_REFS"
mkdir -p "$DEST_CMDS"
echo "  [OK]   $DEST_SKILL"
echo "  [OK]   $DEST_REFS"
echo "  [OK]   $DEST_CMDS"

# ── Copy files ─────────────────────────────────────────────────────────────────
echo ""
echo "==> Installing skill files..."

# Core skill file
copy_file "$SCRIPT_DIR/SKILL.md" "$DEST_SKILL/SKILL.md"

# Reference files
for ref in "$SCRIPT_DIR/references/"*.md; do
  [ -e "$ref" ] || { echo "  [WARN] No reference files found in $SCRIPT_DIR/references/"; break; }
  copy_file "$ref" "$DEST_REFS/$(basename "$ref")"
done

# Interactive /plug command
copy_file "$SCRIPT_DIR/plug-command.md" "$DEST_CMDS/plug.md"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Installation complete."
echo "    Installed ${#installed[@]} file(s):"
for f in "${installed[@]}"; do
  echo "      - $f"
done

if [ ${#overwritten[@]} -gt 0 ]; then
  echo ""
  echo "  [WARN] ${#overwritten[@]} file(s) were overwritten (existing versions replaced)."
fi

echo ""
echo "Usage:"
echo "  • Run /plug in any Claude conversation to open the interactive package browser."
echo "  • Or just ask Claude naturally — the skill will guide it."
echo ""
