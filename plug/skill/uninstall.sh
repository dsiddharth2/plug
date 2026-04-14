#!/usr/bin/env bash
# uninstall.sh — Removes PlugVault skill files from ~/.claude/
# Works on macOS, Linux, and Windows Git Bash (POSIX-compatible)

set -euo pipefail

# ── Paths ──────────────────────────────────────────────────────────────────────
DEST_SKILL="$HOME/.claude/skills/plug"
DEST_REFS="$HOME/.claude/skills/plug/references"
DEST_CMDS="$HOME/.claude/commands"

# ── Helpers ────────────────────────────────────────────────────────────────────
removed=()
missing=()

remove_file() {
  local path="$1"
  if [ -e "$path" ]; then
    rm -f "$path"
    removed+=("$path")
    echo "  [OK]   Removed: $path"
  else
    missing+=("$path")
    echo "  [SKIP] Not found: $path"
  fi
}

remove_dir_if_empty() {
  local dir="$1"
  if [ -d "$dir" ] && [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
    rmdir "$dir"
    echo "  [OK]   Removed empty directory: $dir"
  elif [ -d "$dir" ]; then
    echo "  [SKIP] Directory not empty, left in place: $dir"
  fi
}

# ── Remove files ───────────────────────────────────────────────────────────────
echo ""
echo "==> Removing PlugVault skill files..."

remove_file "$DEST_SKILL/SKILL.md"
remove_file "$DEST_REFS/config-schema.md"
remove_file "$DEST_REFS/install.md"
remove_file "$DEST_REFS/search-and-list.md"
remove_file "$DEST_REFS/vault-management.md"

# ── Remove empty directories ───────────────────────────────────────────────────
echo ""
echo "==> Cleaning up empty directories..."
remove_dir_if_empty "$DEST_REFS"
remove_dir_if_empty "$DEST_SKILL"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "==> Uninstall complete."
echo "    Removed ${#removed[@]} file(s)."

if [ ${#missing[@]} -gt 0 ]; then
  echo "    ${#missing[@]} file(s) were already absent (skipped)."
fi
echo ""
