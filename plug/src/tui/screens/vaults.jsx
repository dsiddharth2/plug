import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTerminalSize } from '../hooks/use-terminal-size.js';
import { usePaste } from '../hooks/use-paste.js';
import Spinner from '../components/spinner.jsx';
import { useVaults } from '../hooks/use-vaults.js';
import { captureOutput, yieldToInk } from '../utils/capture-stdout.js';
import {
  runVaultAdd,
  runVaultRemove,
  runVaultSetDefault,
  runVaultSync,
} from '../../commands/vault.js';
import { fetchRegistry } from '../../utils/registry.js';
import { getConfig } from '../../utils/config.js';
import { ctx } from '../../utils/context.js';

/** @typedef {'list'|'confirm-remove'|'adding'|'syncing'|'result'} VaultView */

/**
 * Vaults screen — shows registered vaults and supports add/remove/sync/set-default.
 *
 * @param {{ onInputCapture: (locked: boolean) => void }} props
 */
export default function VaultsScreen({ onInputCapture }) {
  const { vaults, loading, error, reload } = useVaults();
  const [view, setView] = useState(/** @type {VaultView} */ ('list'));
  const [cursor, setCursor] = useState(0);
  const [opResult, setOpResult] = useState(null);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [addState, setAddState] = useState(null); // { step, name, url, branch, private }
  const [syncResults, setSyncResults] = useState([]);
  const { columns: terminalWidth } = useTerminalSize();

  // Notify parent when input is locked
  useEffect(() => {
    onInputCapture(view !== 'list');
  }, [view, onInputCapture]);

  // List-view keys
  useInput((input, key) => {
    if (view !== 'list') return;

    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    }
    if (key.downArrow) {
      setCursor((c) => Math.min(Math.max(0, vaults.length - 1), c + 1));
    }

    if (input === 'a') {
      setAddState({ step: 'name', name: '', url: '', branch: 'main', isPrivate: false });
      setView('adding');
    }

    if (input === 'r' && vaults.length > 0) {
      const vault = vaults[cursor];
      if (vault && !vault.isCommunity) {
        setPendingRemove(vault);
        setView('confirm-remove');
      }
    }

    if (input === 'd' && vaults.length > 0) {
      const vault = vaults[cursor];
      if (vault && !vault.isDefault && !vault.isCommunity) {
        doSetDefault(vault.name);
      }
    }

    if (input === 's') {
      doSync();
    }
  });

  // ── Set Default ─────────────────────────────────────────────────────────────

  async function doSetDefault(name) {
    try {
      ctx.set({ yes: true, json: true });
      await yieldToInk();
      await captureOutput(() => runVaultSetDefault(name));
      ctx.set({ yes: false, json: false });
      reload();
      setOpResult({ type: 'set-default', name, ok: true });
      setView('result');
    } catch (err) {
      ctx.set({ yes: false, json: false });
      setOpResult({ type: 'set-default', name, ok: false, error: err.message });
      setView('result');
    }
  }

  // ── Remove ─────────────────────────────────────────────────────────────────

  async function doRemove(vault) {
    try {
      ctx.set({ yes: true, json: true });
      await yieldToInk();
      await captureOutput(() => runVaultRemove(vault.name));
      ctx.set({ yes: false, json: false });
      setCursor(0);
      reload();
      setOpResult({ type: 'remove', name: vault.name, ok: true });
      setPendingRemove(null);
      setView('result');
    } catch (err) {
      ctx.set({ yes: false, json: false });
      setOpResult({ type: 'remove', name: vault.name, ok: false, error: err.message });
      setPendingRemove(null);
      setView('result');
    }
  }

  // ── Sync ───────────────────────────────────────────────────────────────────

  async function doSync() {
    setSyncResults([]);
    setView('syncing');

    try {
      const config = await getConfig();
      const order = config.resolve_order || [];
      const perVault = [];

      for (const name of order) {
        const v = config.vaults?.[name];
        if (!v) continue;

        try {
          const registry = await fetchRegistry(v);
          const count = Object.keys(registry.packages || {}).length;
          perVault.push({ name, ok: true, packages: count });
        } catch (err) {
          perVault.push({ name, ok: false, error: err.message });
        }

        setSyncResults([...perVault]);
      }

      reload();
      setOpResult({ type: 'sync', results: perVault });
      setView('result');
    } catch (err) {
      setOpResult({ type: 'sync', results: [], error: err.message });
      setView('result');
    }
  }

  // ── Add ────────────────────────────────────────────────────────────────────

  async function doAdd(name, url, branch, isPrivate) {
    setOpResult(null);
    setView('syncing'); // Reuse syncing spinner for connectivity check
    setSyncResults([]);

    try {
      ctx.set({ yes: true, json: true });
      await yieldToInk();
      await captureOutput(() => runVaultAdd(name, url, { private: isPrivate }));
      ctx.set({ yes: false, json: false });
      reload();
      setOpResult({ type: 'add', name, ok: true });
      setAddState(null);
      setView('result');
    } catch (err) {
      ctx.set({ yes: false, json: false });
      setOpResult({ type: 'add', name, ok: false, error: err.message });
      setAddState(null);
      setView('result');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'adding' && addState) {
    return (
      <AddVaultForm
        state={addState}
        onChange={setAddState}
        onSubmit={(name, url, branch, isPrivate) => doAdd(name, url, branch, isPrivate)}
        onCancel={() => { setAddState(null); setView('list'); }}
        terminalWidth={terminalWidth}
      />
    );
  }

  if (view === 'confirm-remove' && pendingRemove) {
    return (
      <ConfirmRemoveVault
        vault={pendingRemove}
        onConfirm={() => doRemove(pendingRemove)}
        onCancel={() => { setPendingRemove(null); setView('list'); }}
      />
    );
  }

  if (view === 'syncing') {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Spinner label="Syncing vaults…" />
        {syncResults.map((r) => (
          <Box key={r.name}>
            {r.ok ? (
              <Text color="green">  ✓ {r.name}: {r.packages} packages</Text>
            ) : (
              <Text color="yellow">  ✗ {r.name}: {r.error}</Text>
            )}
          </Box>
        ))}
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
        <Spinner label="Loading vaults…" />
      </Box>
    );
  }

  if (error) {
    return (
      <Box paddingX={2} paddingY={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Could not read vault config</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <VaultList vaults={vaults} cursor={cursor} terminalWidth={terminalWidth} />
      <VaultStatusLine cursor={cursor} total={vaults.length} />
    </Box>
  );
}

// ── VaultList ─────────────────────────────────────────────────────────────────

function VaultList({ vaults, cursor, terminalWidth }) {
  if (vaults.length === 0) {
    return (
      <Box paddingX={1} flexDirection="column">
        <Text dimColor>No vaults configured.</Text>
        <Text dimColor>Press [a] to add a vault.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {vaults.map((vault, i) => (
        <VaultItem
          key={vault.name}
          vault={vault}
          isCursor={i === cursor}
          terminalWidth={terminalWidth}
        />
      ))}
    </Box>
  );
}

function VaultItem({ vault, isCursor, terminalWidth }) {
  const star = vault.isDefault ? '★' : ' ';
  const cursorStr = isCursor ? '>' : ' ';
  const privLabel = vault.isCommunity ? '[community]' : vault.private ? '[private]' : '[public] ';
  const pkgStr = vault.packageCount !== null ? `${vault.packageCount} pkgs` : '? pkgs';

  const line1 = `${vault.name} · ${vault.owner}/${vault.repo} · ${vault.branch} · ${privLabel} · ${pkgStr}`;
  const prefixLen = 4; // "  > "
  const maxLine1 = terminalWidth - prefixLen - 2;
  const truncLine1 = line1.length > maxLine1 ? line1.slice(0, maxLine1 - 1) + '…' : line1;

  // Line 2: GitHub URL
  const maxLine2 = terminalWidth - 6;
  const url = vault.githubUrl;
  const truncUrl = url.length > maxLine2 ? url.slice(0, maxLine2 - 1) + '…' : url;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="yellow">{star} </Text>
        <Text bold={isCursor} color={isCursor ? 'blue' : undefined}>{cursorStr} </Text>
        <Text bold={isCursor}>{truncLine1}</Text>
      </Box>
      <Box paddingLeft={4}>
        <Text dimColor>{truncUrl}</Text>
      </Box>
    </Box>
  );
}

function VaultStatusLine({ cursor, total }) {
  const position = total > 0 ? `${cursor + 1}/${total}` : '0/0';

  return (
    <Box paddingX={1}>
      <Text dimColor>
        Vaults {position}  [a] Add  [r] Remove  [d] Set Default  [s] Sync
      </Text>
    </Box>
  );
}

// ── ConfirmRemoveVault ────────────────────────────────────────────────────────

function ConfirmRemoveVault({ vault, onConfirm, onCancel }) {
  const isProtected = vault.name === 'official' || vault.isCommunity;

  useInput((input, key) => {
    if (key.escape || input === 'n' || input === 'N') onCancel();
    if (!isProtected && (input === 'y' || input === 'Y')) onConfirm();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold color="red">Remove Vault</Text>
      </Box>

      {isProtected ? (
        <>
          <Box marginBottom={1}>
            <Text color="yellow">
              {vault.isCommunity
                ? 'Cannot remove community vault sources — they are read-only.'
                : 'Cannot remove the official vault — it is required for plug to function.'}
            </Text>
          </Box>
          <Box>
            <Text dimColor>Press Esc or [n] to go back</Text>
          </Box>
        </>
      ) : (
        <>
          <Box marginBottom={1}>
            <Text>Remove vault </Text>
            <Text bold color="cyan">{vault.name}</Text>
            <Text> ({vault.owner}/{vault.repo})?</Text>
          </Box>
          <Box>
            <Text bold color="green">[y]</Text>
            <Text> Yes  </Text>
            <Text bold color="gray">[n]</Text>
            <Text> No / Esc</Text>
          </Box>
        </>
      )}
    </Box>
  );
}

// ── AddVaultForm ──────────────────────────────────────────────────────────────

/**
 * Sequential inline prompts: name → url → (optional) branch → submit.
 * Uses raw key input — no TextInput dependency needed.
 */
function AddVaultForm({ state, onChange, onSubmit, onCancel, terminalWidth }) {
  const [inputBuffer, setInputBuffer] = useState('');

  useInput((ch, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return) {
      handleSubmitStep();
      return;
    }

    if (key.backspace || key.delete) {
      setInputBuffer((prev) => prev.slice(0, -1));
      return;
    }

    // Printable character
    if (ch && ch.length === 1 && !key.ctrl && !key.meta) {
      setInputBuffer((prev) => prev + ch);
    }
  });

  // Handle bracketed paste as a single insert (#11)
  usePaste(useCallback((text) => {
    setInputBuffer((prev) => prev + text);
  }, []));

  function handleSubmitStep() {
    const value = inputBuffer.trim();

    if (state.step === 'name') {
      if (!value) return; // require non-empty
      onChange({ ...state, step: 'url', name: value });
      setInputBuffer('');
    } else if (state.step === 'url') {
      if (!value) return;
      onChange({ ...state, step: 'branch', url: value });
      setInputBuffer('main'); // default
    } else if (state.step === 'branch') {
      const branch = value || 'main';
      onChange({ ...state, step: 'private', branch });
      setInputBuffer('');
    } else if (state.step === 'private') {
      const isPrivate = value.toLowerCase() === 'y';
      onSubmit(state.name, state.url, state.branch, isPrivate);
    }
  }

  const prompts = {
    name: 'Vault name (e.g. "myorg"):',
    url: 'GitHub URL (e.g. https://github.com/owner/repo):',
    branch: `Branch [default: main]:`,
    private: 'Private vault? [y/N]:',
  };

  const prompt = prompts[state.step] || '';

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Box marginBottom={1}>
        <Text bold>Add Vault</Text>
        <Text dimColor>  Esc to cancel</Text>
      </Box>

      {/* Show completed steps */}
      {state.name && state.step !== 'name' && (
        <Box>
          <Text dimColor>Name   : </Text>
          <Text>{state.name}</Text>
        </Box>
      )}
      {state.url && state.step !== 'url' && state.step !== 'name' && (
        <Box>
          <Text dimColor>URL    : </Text>
          <Text>{state.url}</Text>
        </Box>
      )}
      {state.branch && state.step === 'private' && (
        <Box>
          <Text dimColor>Branch : </Text>
          <Text>{state.branch}</Text>
        </Box>
      )}

      {/* Current prompt */}
      <Box marginTop={1}>
        <Text>{prompt} </Text>
        <Text color="cyan">{inputBuffer}</Text>
        <Text color="cyan">_</Text>
      </Box>
      <Box>
        <Text dimColor>Enter to confirm</Text>
      </Box>
    </Box>
  );
}

// ── OperationResult ───────────────────────────────────────────────────────────

function OperationResult({ result, onDone }) {
  useInput((input, key) => {
    if (key.escape || key.return || input) onDone();
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {result.type === 'sync' && (
        <>
          <Box marginBottom={1}><Text bold>Sync complete</Text></Box>
          {result.error && <Text color="red">Error: {result.error}</Text>}
          {(result.results || []).map((r) => (
            <Box key={r.name}>
              {r.ok ? (
                <Text color="green">✓ {r.name}: {r.packages} packages</Text>
              ) : (
                <Text color="yellow">✗ {r.name}: {r.error}</Text>
              )}
            </Box>
          ))}
        </>
      )}

      {result.type === 'set-default' && (
        <>
          <Box marginBottom={1}><Text bold>Set Default</Text></Box>
          {result.ok ? (
            <Text color="green">✓ {result.name} is now the default vault</Text>
          ) : (
            <Text color="red">✗ {result.error}</Text>
          )}
        </>
      )}

      {result.type === 'remove' && (
        <>
          <Box marginBottom={1}><Text bold>Remove Vault</Text></Box>
          {result.ok ? (
            <Text color="green">✓ Vault '{result.name}' removed</Text>
          ) : (
            <Text color="red">✗ {result.error}</Text>
          )}
        </>
      )}

      {result.type === 'add' && (
        <>
          <Box marginBottom={1}><Text bold>Add Vault</Text></Box>
          {result.ok ? (
            <Text color="green">✓ Vault '{result.name}' added</Text>
          ) : (
            <Text color="red">✗ {result.error}</Text>
          )}
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>Any key to continue</Text>
      </Box>
    </Box>
  );
}
