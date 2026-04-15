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
 *   isActive?: boolean,
 * }} props
 */
export default function PackageList({ items = [], viewportHeight = 10, onSelect, isActive = true }) {
  const [cursor, setCursor] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [toggled, setToggled] = useState(new Set());
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;

  // Lines per item: 1 if no description, 2 if has description
  const itemHeight = (item) => item.description ? 2 : 1;

  // Build a viewport window: find how many items fit in viewportHeight rows
  const windowedItems = buildWindow(items, cursor, scrollOffset, viewportHeight);

  useInput((input, key) => {
    if (!isActive || items.length === 0) return;

    if (key.upArrow) {
      const next = Math.max(0, cursor - 1);
      setCursor(next);
      setScrollOffset(off => adjustScroll(off, next, items, viewportHeight));
    }
    if (key.downArrow) {
      const next = Math.min(items.length - 1, cursor + 1);
      setCursor(next);
      setScrollOffset(off => adjustScroll(off, next, items, viewportHeight));
    }
    if (input === ' ') {
      setToggled(prev => {
        const next = new Set(prev);
        if (next.has(cursor)) {
          next.delete(cursor);
        } else {
          next.add(cursor);
        }
        return next;
      });
    }
    if (key.return && onSelect) {
      onSelect(items[cursor]);
    }
  });

  if (items.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No packages found.</Text>
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
          key={`${item.name}-${item.vault}-${index}`}
          item={item}
          isCursor={index === cursor}
          isToggled={toggled.has(index)}
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
    const rows = items[i].description ? 2 : 1;
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
    const rows = items[i].description ? 2 : 1;
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
