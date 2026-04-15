import React from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Search box component. Activated by '/' from the parent, receives keystrokes
 * while focused, and calls onBlur on Esc.
 *
 * @param {{
 *   query: string,
 *   focused: boolean,
 *   onChange: (query: string) => void,
 *   onBlur: () => void,
 * }} props
 */
export default function SearchBox({ query, focused, onChange, onBlur }) {
  useInput((input, key) => {
    if (!focused) return;

    if (key.escape) {
      onChange('');
      onBlur();
      return;
    }

    if (key.backspace || key.delete) {
      onChange(query.slice(0, -1));
      return;
    }

    // Ignore control sequences and non-printable chars
    if (!key.ctrl && !key.meta && input && input.length === 1) {
      onChange(query + input);
    }
  });

  if (!focused && !query) return null;

  return (
    <Box paddingX={1} paddingY={0}>
      <Text color="cyan" bold>{'/ '}</Text>
      <Text>{query}</Text>
      {focused && <Text color="cyan">█</Text>}
    </Box>
  );
}
