import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import PackageList from '../components/package-list.jsx';
import SearchBox from '../components/search-box.jsx';
import StatusLine from '../components/status-line.jsx';
import Spinner from '../components/spinner.jsx';
import PackageDetail from '../components/package-detail.jsx';
import InstallProgress from '../components/install-progress.jsx';
import InstallComplete from '../components/install-complete.jsx';
import { usePackages } from '../hooks/use-packages.js';
import { useSearch } from '../hooks/use-search.js';
import { captureOutput } from '../utils/capture-stdout.js';
import { runInstall } from '../../commands/install.js';
import { getInstalled } from '../../utils/tracker.js';
import { ctx } from '../../utils/context.js';

/** @typedef {'list'|'detail'|'installing'|'complete'} DiscoverView */

/**
 * Discover screen: lists all packages from configured vaults.
 * Supports live search, detail panel, and install (single + batch).
 *
 * @param {{ onInputCapture: (locked: boolean) => void }} props
 */
export default function DiscoverScreen({ onInputCapture }) {
  const { packages, loading, error } = usePackages();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [view, setView] = useState(/** @type {DiscoverView} */ ('list'));
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [toggled, setToggled] = useState(new Set());
  const [cursor, setCursor] = useState(0);
  const [installQueue, setInstallQueue] = useState([]);
  const [installResults, setInstallResults] = useState([]);
  const [currentInstalling, setCurrentInstalling] = useState(null);
  const [installedNames, setInstalledNames] = useState(new Set());

  // Filtered/searched package list
  const filteredPackages = useSearch(packages, searchQuery);

  // Load installed package names
  useEffect(() => {
    async function loadInstalled() {
      try {
        const local = await getInstalled(false);
        const global = await getInstalled(true);
        const names = new Set([
          ...Object.keys(local.installed || {}),
          ...Object.keys(global.installed || {}),
        ]);
        setInstalledNames(names);
      } catch {
        // ignore
      }
    }
    loadInstalled();
  }, []);

  // Notify parent when input is locked (detail/install views)
  useEffect(() => {
    onInputCapture(view !== 'list');
  }, [view, onInputCapture]);

  // '/' activates search when in list view and not already focused
  useInput((input, key) => {
    if (view !== 'list') return;
    if (searchFocused) return;

    if (input === '/') {
      setSearchFocused(true);
      return;
    }

    // Action keys only fire when search is unfocused
    if (input === 'i' && filteredPackages.length > 0) {
      const queue = toggled.size > 0
        ? [...toggled].map((idx) => filteredPackages[idx]).filter(Boolean)
        : cursor < filteredPackages.length ? [filteredPackages[cursor]] : [];

      if (queue.length > 0) {
        startInstall(queue);
      }
    }
  });

  const handleSelect = useCallback((item) => {
    setSelectedPkg(item);
    setView('detail');
  }, []);

  const handleDetailBack = useCallback(() => {
    setView('list');
    setSelectedPkg(null);
  }, []);

  const handleDetailInstall = useCallback((pkg) => {
    startInstall([pkg]);
  }, []);

  const handleToggle = useCallback((index) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleCursorChange = useCallback((index) => {
    setCursor(index);
  }, []);

  const handleInstallDone = useCallback(() => {
    // Refresh installed names after install
    getInstalled(false).then((local) => {
      getInstalled(true).then((global) => {
        setInstalledNames(new Set([
          ...Object.keys(local.installed || {}),
          ...Object.keys(global.installed || {}),
        ]));
      });
    }).catch(() => {});
    setToggled(new Set());
    setInstallResults([]);
    setInstallQueue([]);
    setCurrentInstalling(null);
    setView('list');
  }, []);

  function startInstall(queue) {
    setInstallQueue(queue);
    setInstallResults([]);
    setCurrentInstalling(null);
    setView('installing');
    doInstall(queue);
  }

  async function doInstall(queue) {
    const results = [];
    // Set yes=true to skip interactive prompts, json=true to get structured output
    ctx.set({ yes: true, json: true });

    for (const pkg of queue) {
      setCurrentInstalling(pkg.name);
      try {
        const { captured } = await captureOutput(() =>
          runInstall(`${pkg.vault}/${pkg.name}`, { global: false })
        );
        // Parse JSON output to get install path
        let installPath = null;
        let installType = pkg.type;
        try {
          const parsed = JSON.parse(captured.trim());
          installPath = parsed.path;
          installType = parsed.type || pkg.type;
        } catch {
          // Ignore parse errors — path isn't critical for the summary
        }
        results.push({
          name: pkg.name,
          status: 'success',
          path: installPath,
          type: installType,
        });
      } catch (err) {
        results.push({
          name: pkg.name,
          status: 'error',
          error: err.message || 'Install failed',
          type: pkg.type,
        });
      }
      setInstallResults([...results]);
    }

    ctx.set({ yes: false, json: false });
    setCurrentInstalling(null);
    setView('complete');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (view === 'detail' && selectedPkg) {
    return (
      <PackageDetail
        pkg={selectedPkg}
        onBack={handleDetailBack}
        onInstall={handleDetailInstall}
        isInstalled={installedNames.has(selectedPkg.name)}
      />
    );
  }

  if (view === 'installing') {
    return (
      <InstallProgress
        packages={installQueue}
        results={installResults}
        currentName={currentInstalling}
      />
    );
  }

  if (view === 'complete') {
    return (
      <InstallComplete
        results={installResults}
        onDone={handleInstallDone}
      />
    );
  }

  // List view
  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Spinner label="Fetching packages from vaults…" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box paddingX={2} paddingY={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Check your network connection and vault configuration.</Text>
      </Box>
    );
  }

  const isFiltered = searchQuery.trim().length > 0;

  return (
    <Box flexDirection="column" flexGrow={1}>
      <SearchBox
        query={searchQuery}
        focused={searchFocused}
        onChange={setSearchQuery}
        onBlur={() => setSearchFocused(false)}
      />

      <PackageList
        items={filteredPackages}
        viewportHeight={16}
        onSelect={handleSelect}
        onCursorChange={handleCursorChange}
        isActive={!searchFocused}
        toggled={toggled}
        onToggle={handleToggle}
        installedNames={installedNames}
      />

      <StatusLine
        cursor={cursor}
        total={packages.length}
        filtered={filteredPackages.length}
        isFiltered={isFiltered}
        searchFocused={searchFocused}
      />
    </Box>
  );
}
