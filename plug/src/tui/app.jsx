import React, { useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TabBar, { TAB_LABELS } from './components/tab-bar.jsx';
import HotkeyBar from './components/hotkey-bar.jsx';
import DiscoverScreen from './screens/discover.jsx';
import InstalledScreen from './screens/installed.jsx';
import VaultsScreen from './screens/vaults.jsx';

/**
 * Root TUI component. Handles tab switching and global key bindings.
 * Screens can lock global input (e.g. during detail/install views) via onInputCapture.
 */
export default function App() {
  const { exit } = useApp();
  const [activeTab, setActiveTab] = useState(0);
  const [inputLocked, setInputLocked] = useState(false);

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
  }, { isActive: !inputLocked });

  const handleInputCapture = useCallback((locked) => {
    setInputLocked(locked);
  }, []);

  return (
    <Box flexDirection="column">
      <TabBar activeTab={activeTab} />
      <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        <ActiveTabContent activeTab={activeTab} onInputCapture={handleInputCapture} />
      </Box>
      <HotkeyBar activeTab={activeTab} />
    </Box>
  );
}

/** Renders the active tab's screen. */
function ActiveTabContent({ activeTab, onInputCapture }) {
  if (activeTab === 0) {
    return <DiscoverScreen onInputCapture={onInputCapture} />;
  }
  if (activeTab === 1) {
    return <InstalledScreen onInputCapture={onInputCapture} />;
  }
  if (activeTab === 2) {
    return <VaultsScreen onInputCapture={onInputCapture} />;
  }
  return null;
}
