import React from 'react';
import { Box, Text } from 'ink';
import Spinner from './spinner.jsx';

/**
 * Shows per-package install progress.
 * Each package shows a spinner (in progress), checkmark (done), or X (failed).
 *
 * @param {{
 *   packages: Array<{ name: string, vault: string, type: string }>,
 *   results: Array<{ name: string, status: 'pending' | 'success' | 'error', error?: string }>,
 *   currentName: string | null,
 * }} props
 */
export default function InstallProgress({ packages, results, currentName }) {
  const resultMap = Object.fromEntries(results.map((r) => [r.name, r]));

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>Installing packages…</Text>
      </Box>

      {packages.map((pkg) => {
        const result = resultMap[pkg.name];
        const isCurrent = pkg.name === currentName;

        let indicator;
        if (result?.status === 'success') {
          indicator = <Text color="green">✓</Text>;
        } else if (result?.status === 'error') {
          indicator = <Text color="red">✗</Text>;
        } else if (isCurrent) {
          indicator = <Spinner />;
        } else {
          indicator = <Text dimColor>·</Text>;
        }

        return (
          <Box key={pkg.name}>
            <Box width={3}>{indicator}</Box>
            <Text bold={isCurrent}>{pkg.name}</Text>
            <Text dimColor> ({pkg.vault})</Text>
            {result?.status === 'error' && (
              <Text color="red"> — {result.error}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
