import React, { useState, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from './spinner.jsx';

/**
 * Dependency install plan screen.
 * Shows what will be installed and what's already satisfied,
 * lets the user pick project vs global scope, then confirm or cancel.
 *
 * @param {{
 *   queue: Array<{ name: string, vault: string, type: string }>,
 *   plan: { toInstall: string[], alreadySatisfied: string[], cycles: string[] },
 *   loading: boolean,
 *   onConfirm: (scope: 'project' | 'global') => void,
 *   onCancel: () => void,
 * }} props
 */
export default function InstallPlan({ queue, plan, loading, onConfirm, onCancel }) {
  const [scope, setScope] = useState(/** @type {'project' | 'global'} */ ('project'));
  const confirmedRef = useRef(false);

  useInput((input, key) => {
    if (loading) return;

    if (key.tab || key.leftArrow || key.rightArrow) {
      setScope((s) => (s === 'project' ? 'global' : 'project'));
      return;
    }

    if (input === 'i' || input === 'y' || key.return) {
      if (!confirmedRef.current) {
        confirmedRef.current = true;
        onConfirm(scope);
      }
      return;
    }

    if (key.escape) {
      onCancel();
    }
  });

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Spinner label="Resolving dependencies…" />
      </Box>
    );
  }

  const toInstall = plan?.toInstall ?? [];
  const alreadySatisfied = plan?.alreadySatisfied ?? [];

  // Build a lookup map of vault+type from the original queue
  const queueMap = Object.fromEntries((queue ?? []).map((p) => [p.name, p]));

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Will install */}
      <Box marginBottom={1}>
        <Text bold>Will install ({toInstall.length})</Text>
      </Box>

      {toInstall.map((name) => {
        const info = queueMap[name];
        return (
          <Box key={name}>
            <Text color="cyan">  + </Text>
            <Text bold={!!info}>{name}</Text>
            {info && (
              <Text dimColor>  ({info.vault} / {info.type})</Text>
            )}
          </Box>
        );
      })}

      {/* Already satisfied */}
      {alreadySatisfied.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          <Text dimColor>Already satisfied ({alreadySatisfied.length})</Text>
          {alreadySatisfied.map((name) => (
            <Box key={name}>
              <Text color="green" dimColor>  ✓ </Text>
              <Text dimColor>{name}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Scope selector */}
      <Box marginTop={1} marginBottom={1}>
        <Text bold={scope === 'project'} color={scope === 'project' ? 'cyan' : undefined}>
          {scope === 'project' ? '◉' : '○'} Project (.claude/)
        </Text>
        <Text>{'  '}</Text>
        <Text bold={scope === 'global'} color={scope === 'global' ? 'cyan' : undefined}>
          {scope === 'global' ? '◉' : '○'} Global (~/.claude/)
        </Text>
        <Text dimColor>  [Tab] toggle</Text>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingTop={1}>
        <Text bold color="cyan">[i]</Text>
        <Text> Install</Text>
        <Text>   </Text>
        <Text bold color="cyan">[Esc]</Text>
        <Text> Cancel</Text>
      </Box>
    </Box>
  );
}
