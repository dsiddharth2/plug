import React from 'react';
import { Box, Text } from 'ink';

/**
 * Single package row in the list.
 *
 * Supports two modes:
 *  - 'discover' (default): line 2 shows description
 *  - 'installed': line 2 shows file path; version shows update indicator when available
 *
 * Layout (2 lines per package):
 *   [x] > name · vault · version  [type]  [scope]
 *       <description -or- /path/to/file>
 *
 * @param {{
 *   item: object,
 *   isCursor: boolean,
 *   isToggled: boolean,
 *   isInstalled?: boolean,
 *   mode?: 'discover'|'installed',
 *   terminalWidth?: number,
 * }} props
 */
export default function PackageItem({
  item,
  isCursor,
  isToggled,
  isInstalled = false,
  mode = 'discover',
  terminalWidth = 80,
}) {
  const checkbox = isToggled ? '[x]' : isInstalled ? '[✓]' : '[ ]';
  const cursor = isCursor ? '>' : ' ';
  const typeLabel = item.type ? `[${item.type}]` : '';

  // Scope badge — only shown in installed mode
  const scopeLabel = mode === 'installed' && item.scope ? `[${item.scope}]` : '';

  // Update indicator — e.g. "v1.2.0 → v1.3.0 ⬆"
  const versionStr = item.version ? `v${item.version}` : '';
  const updateStr = mode === 'installed' && item.hasUpdate && item.latestVersion
    ? ` → v${item.latestVersion} ⬆`
    : '';

  // Prefix: "[ ] > " = 6 chars
  const prefixLen = 6;
  const suffixLen = (typeLabel ? typeLabel.length + 1 : 0) + (scopeLabel ? scopeLabel.length + 1 : 0);
  const nameLine = `${item.name} · ${item.vault}${versionStr ? ` · ${versionStr}` : ''}${updateStr}`;
  const maxNameLen = terminalWidth - prefixLen - suffixLen - 2;
  const truncatedName = nameLine.length > maxNameLen
    ? nameLine.slice(0, maxNameLen - 1) + '…'
    : nameLine;

  // Line 2: path in installed mode, description in discover mode
  const descIndent = 4;
  const maxDescLen = terminalWidth - descIndent - 2;
  const line2Raw = mode === 'installed'
    ? (item.path || '')
    : (item.description ?? '');
  const line2 = line2Raw.length > maxDescLen
    ? '…' + line2Raw.slice(-(maxDescLen - 1))
    : line2Raw;

  return (
    <Box flexDirection="column">
      {/* Line 1: checkbox · cursor · name info · type badge · scope badge */}
      <Box>
        <Text color={isToggled ? 'yellow' : isInstalled ? 'green' : 'gray'}>{checkbox} </Text>
        <Text bold={isCursor} color={isCursor ? 'blue' : undefined}>{cursor} </Text>
        <Text bold={isCursor} color={mode === 'installed' && item.hasUpdate ? 'cyan' : undefined}>
          {truncatedName}
        </Text>
        {typeLabel ? (
          <Text color="magenta"> {typeLabel}</Text>
        ) : null}
        {scopeLabel ? (
          <Text color="yellow"> {scopeLabel}</Text>
        ) : null}
      </Box>
      {/* Line 2: description or path */}
      {line2 ? (
        <Box paddingLeft={descIndent}>
          <Text dimColor>{line2}</Text>
        </Box>
      ) : null}
    </Box>
  );
}
