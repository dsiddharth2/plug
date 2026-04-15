import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TabBar, { TAB_LABELS } from './components/tab-bar.jsx';
import HotkeyBar from './components/hotkey-bar.jsx';

/**
 * Root TUI component. Handles tab switching and global key bindings.
 * Each tab's screen will be rendered here as Phase 2/3 screens are added.
 */
export default function App() {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      exit();
    }
    if (key.leftArrow) {
      setActiveTab(t => Math.max(0, t - 1));
    }
    if (key.rightArrow) {
      setActiveTab(t => Math.min(TAB_LABELS.length - 1, t + 1));
    }
  });

  return (
    <Box flexDirection="column">
      <TabBar activeTab={activeTab} />
      <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        <ActiveTabContent activeTab={activeTab} />
      </Box>
      <HotkeyBar activeTab={activeTab} />
    </Box>
  );
}

/** Placeholder content for each tab until Phase 2/3 screens are implemented. */
function ActiveTabContent({ activeTab }) {
  const labels = ['Discover', 'Installed', 'Vaults'];
  return (
    <Text dimColor>{labels[activeTab]} — loading…</Text>
  );
}
