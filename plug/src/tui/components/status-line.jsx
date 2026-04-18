import React from 'react';
import { Box, Text } from 'ink';

/**
 * Status line shown below the package list on the Discover tab.
 * Displays current cursor position, total visible count, and optional search hint.
 *
 * @param {{
 *   cursor: number,
 *   total: number,
 *   filtered: number,
 *   isFiltered: boolean,
 *   searchFocused: boolean,
 * }} props
 */
export default function StatusLine({ cursor, total, filtered, isFiltered, searchFocused, typeFilter = 'all' }) {
  const position = total > 0 ? `${cursor + 1}/${filtered}` : '0/0';
  const filterNote = isFiltered ? ` (filtered from ${total})` : '';
  const searchHint = searchFocused ? ' · type to filter · Esc to clear' : '';
  const typeLabel = typeFilter !== 'all'
    ? ` · type: ${typeFilter}s`
    : ' · type: all';

  return (
    <Box paddingX={1}>
      <Text dimColor>
        Discover plugins {position}{filterNote}</Text>
      <Text color={typeFilter !== 'all' ? 'cyan' : 'gray'}>{typeLabel}</Text>
      <Text dimColor>{searchHint}</Text>
    </Box>
  );
}
