import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import PackageList from '../components/package-list.jsx';
import StatusLine from '../components/status-line.jsx';
import Spinner from '../components/spinner.jsx';
import { useInstalled } from '../hooks/use-installed.js';
import { captureOutput, yieldToInk } from '../utils/capture-stdout.js';
import { runUpdate } from '../../commands/update.js';
import { runRemove } from '../../commands/remove.js';
import { ctx } from '../../utils/context.js';

/** @typedef {'list'|'detail'|'confirm-remove'|'operating'|'result'} InstalledView */

/**
 * Installed screen — shows locally and globally installed packages.
 * Supports update (u), remove (r with confirmation), and detail view (Enter).
 *
 * @param {{ onInputCapture: (locked: boolean) => void }} props
 */
export default function InstalledScreen({ onInputCapture }) {
  const { packages, loading, error, reload } = useInstalled();
  const [view, setView] = useState(/** @type {InstalledView} */ ('list'));
  const [cursor, setCursor] = useState(0);
  const [toggled, setToggled] = useState(new Set());
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [opLabel, setOpLabel] = useState('');
  const [opResult, setOpResult] = useState(null);

  // Notify parent when input is locked
  useEffect(() => {
    onInputCapture(view !== 'list');
  }, [view, onInputCapture]);

  // List-view keys
  useInput((input, key) => {
    if (view !== 'list') return;
    if (packages.length === 0) return;

    if (input === 'u') {
      const target = selectedInList(packages, toggled, cursor);
      if (target.length > 0) doUpdate(target);
    }

    if (input === 'r') {
      const target = selectedInList(packages, toggled, cursor);
      if (target.length > 0) {
        setSelectedPkg(target);
        setView('confirm-remove');
      }
    }
  });

  const handleSelect = useCallback((item) => {
    setSelectedPkg(item);
    setView('detail');
  }, []);

  const handleCursorChange = useCallback((index) => {
    setCursor(index);
  }, []);

  const handleToggle = useCallback((index) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  // ── Update ─────────────────────────────────────────────────────────────────

  async function doUpdate(targets) {
    setOpLabel(`Updating ${targets.map((p) => p.name).join(', ')}…`);
    setView('operating');
    ctx.set({ yes: true, json: true });

    const results = [];
    for (const pkg of targets) {
      await yieldToInk();
      try {
        const { captured } = await captureOutput(() =>
          runUpdate(pkg.name, { global: pkg.scope === 'global' })
        );
        let parsed = null;
        try { parsed = JSON.parse(captured.trim()); } catch {}
        const status = parsed?.status || 'updated';
        results.push({ name: pkg.name, status, from: parsed?.from, to: parsed?.to });
      } catch (err) {
        results.push({ name: pkg.name, status: 'error', error: err.message });
      }
    }

    ctx.set({ yes: false, json: false });
    setOpResult({ type: 'update', results });
    reload();
    setToggled(new Set());
    setView('result');
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  async function doRemove(targets) {
    setOpLabel(`Removing ${targets.map((p) => p.name).join(', ')}…`);
    setView('operating');
    ctx.set({ yes: true, json: true });

    const results = [];
    for (const pkg of targets) {
      await yieldToInk();
      try {
        await captureOutput(() =>
          runRemove(pkg.name, { global: pkg.scope === 'global' })
        );
        results.push({ name: pkg.name, status: 'removed' });
      } catch (err) {
        results.push({ name: pkg.name, status: 'error', error: err.message });
      }
    }

    ctx.set({ yes: false, json: false });
    setOpResult({ type: 'remove', results });
    reload();
    setToggled(new Set());
    setView('result');
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  if (view === 'detail' && selectedPkg && !Array.isArray(selectedPkg)) {
    return (
      <InstalledDetail
        pkg={selectedPkg}
        onBack={() => { setSelectedPkg(null); setView('list'); }}
        onUpdate={() => doUpdate([selectedPkg])}
        onRemove={() => { setSelectedPkg([selectedPkg]); setView('confirm-remove'); }}
      />
    );
  }

  if (view === 'confirm-remove' && selectedPkg) {
    return (
      <ConfirmRemove
        targets={Array.isArray(selectedPkg) ? selectedPkg : [selectedPkg]}
        onConfirm={() => doRemove(Array.isArray(selectedPkg) ? selectedPkg : [selectedPkg])}
        onCancel={() => { setSelectedPkg(null); setView('list'); }}
      />
    );
  }

  if (view === 'operating') {
    return (
      <Box paddingX={2} paddingY={1}>
        <Spinner label={opLabel} />
      </Box>
    );
  }

  if (view === 'result' && opResult) {
    return (
      <OperationResult
        result={opResult}
        onDone={() => { setOpResult(null); setView('list'); }}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Spinner label="Loading installed packages…" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box paddingX={2} paddingY={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Could not read installed.json</Text>
      </Box>
    );
  }

  const updatesAvailable = packages.filter((p) => p.hasUpdate).length;

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PackageList
        items={packages}
        viewportHeight={16}
        onSelect={handleSelect}
        onCursorChange={handleCursorChange}
        isActive
        toggled={toggled}
        onToggle={handleToggle}
        mode="installed"
        emptyMessage="No packages installed. Use Discover to find and install packages."
      />
      <InstalledStatusLine
        cursor={cursor}
        total={packages.length}
        updatesAvailable={updatesAvailable}
      />
    </Box>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InstalledDetail({ pkg, onBack, onUpdate, onRemove }) {
  useInput((input, key) => {
    if (key.escape) onBack();
    if (input === 'u') onUpdate();
    if (input === 'r') onRemove();
  });

  const typeColor = pkg.type === 'agent' ? 'yellow' : pkg.type === 'skill' ? 'blue' : 'magenta';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="green">{pkg.name}</Text>
        <Text color={typeColor}> [{pkg.type}]</Text>
        <Text color="yellow"> [{pkg.scope}]</Text>
        {pkg.hasUpdate && (
          <Text color="cyan"> v{pkg.version} → v{pkg.latestVersion} ⬆</Text>
        )}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>Version    : </Text>
          <Text>{pkg.version || '?'}</Text>
        </Box>
        <Box>
          <Text dimColor>Vault      : </Text>
          <Text>{pkg.vault || '?'}</Text>
        </Box>
        <Box>
          <Text dimColor>Scope      : </Text>
          <Text>{pkg.scope}</Text>
        </Box>
        <Box>
          <Text dimColor>Installed  : </Text>
          <Text>{pkg.installedAt ? new Date(pkg.installedAt).toLocaleDateString() : '?'}</Text>
        </Box>
        <Box>
          <Text dimColor>Path       : </Text>
          <Text dimColor>{pkg.path || '?'}</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {pkg.hasUpdate ? (
          <Box>
            <Text bold color="cyan">[u]</Text>
            <Text> Update to v{pkg.latestVersion}</Text>
          </Box>
        ) : (
          <Box>
            <Text dimColor>[u] Up to date</Text>
          </Box>
        )}
        <Box>
          <Text bold color="red">[r]</Text>
          <Text> Remove this package</Text>
        </Box>
      </Box>

      <Box>
        <Text dimColor>Esc to go back</Text>
      </Box>
    </Box>
  );
}

function ConfirmRemove({ targets, onConfirm, onCancel }) {
  useInput((input, key) => {
    if (key.escape || input === 'n' || input === 'N') onCancel();
    if (input === 'y' || input === 'Y') onConfirm();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="red">Confirm Remove</Text>
      </Box>
      <Box marginBottom={1} flexDirection="column">
        {targets.map((pkg) => (
          <Text key={`${pkg.name}-${pkg.scope}`}>
            • {pkg.name} <Text dimColor>[{pkg.scope}]</Text>
          </Text>
        ))}
      </Box>
      <Box>
        <Text>Remove {targets.length === 1 ? 'this package' : 'these packages'}? </Text>
        <Text bold color="green">[y]</Text>
        <Text> Yes  </Text>
        <Text bold color="gray">[n]</Text>
        <Text> No / Esc</Text>
      </Box>
    </Box>
  );
}

function OperationResult({ result, onDone }) {
  const doneRef = useRef(false);
  useInput((input, key) => {
    if (!doneRef.current && (key.escape || key.return || input)) {
      doneRef.current = true;
      onDone();
    }
  });

  const label = result.type === 'update' ? 'Update' : 'Remove';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>{label} complete</Text>
      </Box>
      {result.results.map((r, idx) => (
        <Box key={`${r.name}-${r.status}-${idx}`}>
          {r.status === 'error' ? (
            <Text color="red">✗ {r.name}: {r.error}</Text>
          ) : r.status === 'updated' ? (
            <Text color="green">✓ {r.name}: {r.from} → {r.to}</Text>
          ) : r.status === 'up-to-date' ? (
            <Text dimColor>- {r.name}: already up to date</Text>
          ) : (
            <Text color="green">✓ {r.name}: {r.status}</Text>
          )}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>Any key to continue</Text>
      </Box>
    </Box>
  );
}

function InstalledStatusLine({ cursor, total, updatesAvailable }) {
  const position = total > 0 ? `${cursor + 1}/${total}` : '0/0';
  const updateHint = updatesAvailable > 0 ? ` — ${updatesAvailable} update${updatesAvailable !== 1 ? 's' : ''} available` : '';

  return (
    <Box paddingX={1}>
      <Text dimColor>
        Installed plugins {position}{updateHint}
      </Text>
    </Box>
  );
}

/**
 * Returns the list of packages to act on:
 * - If any are toggled, return those.
 * - Otherwise return the cursor item.
 */
function selectedInList(packages, toggled, cursor) {
  if (toggled.size > 0) {
    return [...toggled].map((i) => packages[i]).filter(Boolean);
  }
  return cursor < packages.length ? [packages[cursor]] : [];
}
