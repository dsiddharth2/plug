import React from 'react';
import { Box, Text } from 'ink';

/**
 * Single package row in the list.
 *
 * Layout (2 lines per package):
 *   [x] > name · vault · version  [type]
 *       description truncated to terminal width
 *
 * @param {{
 *   item: { name: string, vault: string, version: string, type: string, description?: string },
 *   isCursor: boolean,
 *   isToggled: boolean,
 *   terminalWidth?: number,
 * }} props
 */
export default function PackageItem({ item, isCursor, isToggled, isInstalled = false, terminalWidth = 80 }) {
  const checkbox = isToggled ? '[x]' : isInstalled ? '[✓]' : '[ ]';
  const cursor = isCursor ? '>' : ' ';
  const typeLabel = item.type ? `[${item.type}]` : '';

  // Prefix: "[ ] > " = 6 chars
  const prefixLen = 6;
  // Reserve space for type label + padding
  const typePad = typeLabel ? typeLabel.length + 2 : 0;
  const nameLine = `${item.name} · ${item.vault}${item.version ? ` · ${item.version}` : ''}`;
  const maxNameLen = terminalWidth - prefixLen - typePad - 2;
  const truncatedName = nameLine.length > maxNameLen
    ? nameLine.slice(0, maxNameLen - 1) + '…'
    : nameLine;

  // Description indented under name (4 spaces to align with name start)
  const descIndent = 4;
  const maxDescLen = terminalWidth - descIndent - 2;
  const desc = item.description ?? '';
  const truncatedDesc = desc.length > maxDescLen
    ? desc.slice(0, maxDescLen - 1) + '…'
    : desc;

  return (
    <Box flexDirection="column">
      {/* Line 1: checkbox · cursor · name info · type badge */}
      <Box>
        <Text color={isToggled ? 'yellow' : isInstalled ? 'green' : 'gray'}>{checkbox} </Text>
        <Text bold={isCursor} color={isCursor ? 'blue' : undefined}>{cursor} </Text>
        <Text bold={isCursor}>{truncatedName}</Text>
        {typeLabel ? (
          <Text color="magenta"> {typeLabel}</Text>
        ) : null}
      </Box>
      {/* Line 2: description */}
      {desc ? (
        <Box paddingLeft={descIndent}>
          <Text dimColor>{truncatedDesc}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
