import React from 'react';
import { Box, Text } from 'ink';

/** Key hint entries per tab context. */
const HINTS = {
  discover: [
    ['←/→', 'switch tab'],
    ['↑/↓', 'move'],
    ['Enter', 'detail'],
    ['Space', 'toggle'],
    ['/', 'search'],
    ['t', 'filter type'],
    ['i', 'install'],
    ['Esc', 'exit'],
  ],
  installed: [
    ['←/→', 'switch tab'],
    ['↑/↓', 'move'],
    ['Enter', 'detail'],
    ['Space', 'toggle'],
    ['/', 'search'],
    ['u', 'update'],
    ['r', 'remove'],
    ['Esc', 'exit'],
  ],
  vaults: [
    ['←/→', 'switch tab'],
    ['↑/↓', 'move'],
    ['a', 'add vault'],
    ['d', 'set default'],
    ['s', 'sync'],
    ['Esc', 'exit'],
  ],
};

const TAB_CONTEXTS = ['discover', 'installed', 'vaults'];

/**
 * Bottom bar showing context-sensitive keyboard hints.
 *
 * @param {{ activeTab: number }} props
 */
export default function HotkeyBar({ activeTab }) {
  const context = TAB_CONTEXTS[activeTab] ?? 'discover';
  const hints = HINTS[context];

  return (
    <Box borderStyle="single" borderTop={false} paddingX={1}>
      {hints.map(([key, label], i) => (
        <Box key={key} marginRight={i < hints.length - 1 ? 2 : 0}>
          <Text bold color="cyan">{key}</Text>
          <Text color="gray"> {label}</Text>
        </Box>
      ))}
    </Box>
  );
}
