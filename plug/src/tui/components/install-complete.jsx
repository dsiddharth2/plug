import React, { useRef } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Summary screen shown after all installs complete.
 * Displays per-package results with file paths and usage hints.
 * Any key returns to the list.
 *
 * @param {{
 *   results: Array<{ name: string, status: 'success' | 'error', path?: string, type?: string, error?: string }>,
 *   onDone: () => void,
 * }} props
 */
export default function InstallComplete({ results, onDone }) {
  const doneRef = useRef(false);

  useInput(() => {
    if (!doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  });

  const succeeded = results.filter((r) => r.status === 'success');
  const failed = results.filter((r) => r.status === 'error');

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header summary */}
      <Box marginBottom={1}>
        <Text bold>Install complete — </Text>
        <Text color="green">{succeeded.length} installed</Text>
        {failed.length > 0 && (
          <>
            <Text>, </Text>
            <Text color="red">{failed.length} failed</Text>
          </>
        )}
      </Box>

      {/* Successful installs */}
      {succeeded.map((r) => (
        <Box key={r.name} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color="green">✓ </Text>
            <Text bold>{r.name}</Text>
          </Box>
          {r.path && (
            <Box paddingLeft={2}>
              <Text dimColor>Path: {r.path}</Text>
            </Box>
          )}
          {r.type && (
            <Box paddingLeft={2}>
              <Text dimColor>{usageHint(r.name, r.type)}</Text>
            </Box>
          )}
        </Box>
      ))}

      {/* Failed installs */}
      {failed.map((r) => (
        <Box key={r.name} marginBottom={1}>
          <Text color="red">✗ {r.name}</Text>
          <Text dimColor> — {r.error}</Text>
        </Box>
      ))}

      {/* Return hint */}
      <Box marginTop={1}>
        <Text dimColor>Press any key to return to the list</Text>
      </Box>
    </Box>
  );
}

function usageHint(name, type) {
  if (type === 'command') return `Use /${name} to run the command`;
  if (type === 'agent') return `The agent '${name}' is available for delegation`;
  return `The skill '${name}' is active in your Claude project`;
}
