import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import PackageItem from './package-item.jsx';

/**
 * Scrollable, cursor-tracked package list with viewport windowing and Space toggling.
 *
 * @param {{
 *   items: Array<{ name: string, vault: string, version: string, type: string, description?: string }>,
 *   viewportHeight?: number,
 *   onSelect?: (item: object) => void,
 *   onCursorChange?: (index: number, item: object) => void,
 *   isActive?: boolean,
 *   toggled?: Set<number>,
 *   onToggle?: (index: number) => void,
 *   installedNames?: Set<string>,
 *   mode?: 'discover'|'installed',
 *   emptyMessage?: string,
 * }} props
 */
export default function PackageList({
  items = [],
  viewportHeight = 10,
  onSelect,
  onCursorChange,
  isActive = true,
  toggled: externalToggled,
  onToggle,
  installedNames,
  mode = 'discover',
  emptyMessage = 'No packages found.',
}) {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [internalToggled, setInternalToggled] = useState(new Set());
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;

  const toggled = externalToggled !== undefined ? externalToggled : internalToggled;

  // Lines per item: 2 if has description or path (installed mode), else 1
  const itemHeight = (item) => (item.description || item.path) ? 2 : 1;

  // Build a viewport window: find how many items fit in viewportHeight rows
  const windowedItems = buildWindow(items, cursor, scrollOffset, viewportHeight);

  useInput((input, key) => {
    if (!isActive || items.length === 0) return;

    if (key.upArrow) {
      const next = Math.max(0, cursor - 1);
      setCursor(next);
      setScrollOffset(off => adjustScroll(off, next, items, viewportHeight));
      if (onCursorChange) onCursorChange(next, items[next]);
    }
    if (key.downArrow) {
      const next = Math.min(items.length - 1, cursor + 1);
      setCursor(next);
      setScrollOffset(off => adjustScroll(off, next, items, viewportHeight));
      if (onCursorChange) onCursorChange(next, items[next]);
    }
    if (input === ' ') {
      if (onToggle) {
        onToggle(cursor);
      } else {
        setInternalToggled(prev => {
          const next = new Set(prev);
          if (next.has(cursor)) {
            next.delete(cursor);
          } else {
            next.add(cursor);
          }
          return next;
        });
      }
    }
    if (key.return && onSelect) {
      onSelect(items[cursor]);
    }
  });

  if (items.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>{emptyMessage}</Text>
      </Box>
    );
  }

  const showScrollUp = scrollOffset > 0;
  const visibleCount = countVisible(items, scrollOffset, viewportHeight);
  const showScrollDown = scrollOffset + visibleCount < items.length;

  return (
    <Box flexDirection="column">
      {/* Scroll-up indicator */}
      {showScrollUp && (
        <Box>
          <Text dimColor>  ↑ {scrollOffset} more above</Text>
        </Box>
      )}

      {/* Visible items */}
      {windowedItems.map(({ item, index }) => (
        <PackageItem
          key={`${item.name}-${item.vault ?? ''}-${item.scope ?? ''}-${index}`}
          item={item}
          isCursor={index === cursor}
          isToggled={toggled.has(index)}
          isInstalled={installedNames?.has(item.name) ?? false}
          mode={mode}
          terminalWidth={terminalWidth}
        />
      ))}

      {/* Scroll-down indicator */}
      {showScrollDown && (
        <Box>
          <Text dimColor>  ↓ {items.length - scrollOffset - visibleCount} more below</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Compute the list of visible items given the current scroll offset and viewport height.
 * Returns array of { item, index } pairs.
 */
function buildWindow(items, cursor, scrollOffset, viewportHeight) {
  const visible = [];
  let rowsUsed = 0;

  for (let i = scrollOffset; i < items.length; i++) {
    const rows = (items[i].description || items[i].path) ? 2 : 1;
    if (rowsUsed + rows > viewportHeight) break;
    visible.push({ item: items[i], index: i });
    rowsUsed += rows;
  }

  return visible;
}

/**
 * Count how many items fit in the viewport starting from scrollOffset.
 */
function countVisible(items, scrollOffset, viewportHeight) {
  let count = 0;
  let rowsUsed = 0;

  for (let i = scrollOffset; i < items.length; i++) {
    const rows = (items[i].description || items[i].path) ? 2 : 1;
    if (rowsUsed + rows > viewportHeight) break;
    count++;
    rowsUsed += rows;
  }

  return count;
}

/**
 * Adjust scroll offset so cursor stays within the visible window.
 * Scrolls up when cursor moves above the window, down when below it.
 */
function adjustScroll(scrollOffset, cursor, items, viewportHeight) {
  // Scroll up: cursor moved above the window
  if (cursor < scrollOffset) {
    return cursor;
  }

  // Scroll down: check if cursor is beyond the current window
  const visibleCount = countVisible(items, scrollOffset, viewportHeight);
  if (cursor >= scrollOffset + visibleCount) {
    // Find the smallest scrollOffset where cursor is in the window
    let newOffset = cursor;
    while (newOffset > 0) {
      const count = countVisible(items, newOffset - 1, viewportHeight);
      if (newOffset - 1 + count > cursor) {
        newOffset--;
      } else {
        break;
      }
    }
    return newOffset;
  }

  return scrollOffset;
}
