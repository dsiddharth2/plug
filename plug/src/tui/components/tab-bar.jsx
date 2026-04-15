import React from 'react';
import { Box, Text } from 'ink';

const TAB_LABELS = ['Discover', 'Installed', 'Vaults'];

/**
 * Horizontal tab strip. Active tab is rendered with inverse/bold styling.
 *
 * @param {{ activeTab: number }} props
 */
export default function TabBar({ activeTab }) {
  return (
    <Box borderStyle="single" borderBottom={false} paddingX={1}>
      {TAB_LABELS.map((label, i) => {
        const isActive = i === activeTab;
        return (
          <Box key={label} marginRight={1}>
            <Text
              bold={isActive}
              color={isActive ? 'blue' : 'gray'}
              underline={isActive}
            >
              {isActive ? `[ ${label} ]` : `  ${label}  `}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export { TAB_LABELS };
