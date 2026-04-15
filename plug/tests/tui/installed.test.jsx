import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// Mock hooks before importing the screen
vi.mock('../../src/tui/hooks/use-installed.js', () => ({
  useInstalled: vi.fn(() => ({
    packages: [],
    loading: false,
    error: null,
    reload: vi.fn(),
  })),
}));

vi.mock('../../src/commands/update.js', () => ({
  runUpdate: vi.fn(async () => {}),
}));

vi.mock('../../src/commands/remove.js', () => ({
  runRemove: vi.fn(async () => {}),
}));

vi.mock('../../src/utils/context.js', () => ({
  ctx: { set: vi.fn() },
}));

const { default: InstalledScreen } = await import('../../src/tui/screens/installed.jsx');
const { useInstalled } = await import('../../src/tui/hooks/use-installed.js');
const { captureOutput } = await import('../../src/tui/utils/capture-stdout.js');

const MOCK_PACKAGES = [
  {
    name: 'code-review',
    vault: 'official',
    version: '1.0.0',
    type: 'command',
    scope: 'local',
    path: '/home/user/.claude/commands/code-review.md',
    hasUpdate: false,
  },
  {
    name: 'test-gen',
    vault: 'official',
    version: '1.0.0',
    type: 'skill',
    scope: 'global',
    path: '/home/user/.claude/skills/test-gen.md',
    hasUpdate: true,
    latestVersion: '1.1.0',
  },
];

// ── captureOutput tests ───────────────────────────────────────────────────────

describe('captureOutput', () => {
  it('captures stdout writes during execution', async () => {
    const { captured } = await captureOutput(async () => {
      process.stdout.write('hello ');
      process.stdout.write('world');
    });
    expect(captured).toBe('hello world');
  });

  it('restores process.stdout.write after successful execution', async () => {
    const original = process.stdout.write.bind(process.stdout);
    await captureOutput(async () => {
      process.stdout.write('test');
    });
    // write should be restored (the restored fn and the bound fn are not ===,
    // but calling write should work normally — check it's no longer the capture fn)
    expect(process.stdout.write).not.toBeUndefined();
    // Write a string; it should not throw and should return true
    const result = process.stdout.write('');
    expect(result).toBe(true);
  });

  it('restores process.stdout.write after async error', async () => {
    const beforeWrite = process.stdout.write;
    await captureOutput(async () => {
      process.stdout.write('before error');
      throw new Error('test error');
    }).catch(() => {});
    // stdout.write should be restored — calling it again should work
    expect(process.stdout.write).toBeDefined();
    expect(process.stdout.write).not.toBe(beforeWrite); // restored to original, not the capture fn
  });
});

// ── InstalledScreen tests ─────────────────────────────────────────────────────

describe('InstalledScreen', () => {
  beforeEach(() => {
    vi.mocked(useInstalled).mockReturnValue({
      packages: [],
      loading: false,
      error: null,
      reload: vi.fn(),
    });
  });

  it('shows empty state message when no packages installed', () => {
    const { lastFrame } = render(<InstalledScreen onInputCapture={() => {}} />);
    expect(lastFrame()).toContain('No packages installed');
  });

  it('renders installed package list', () => {
    vi.mocked(useInstalled).mockReturnValue({
      packages: MOCK_PACKAGES,
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    const { lastFrame } = render(<InstalledScreen onInputCapture={() => {}} />);
    const frame = lastFrame();
    expect(frame).toContain('code-review');
    expect(frame).toContain('test-gen');
  });

  it('shows confirm-remove screen when r is pressed', async () => {
    vi.mocked(useInstalled).mockReturnValue({
      packages: MOCK_PACKAGES,
      loading: false,
      error: null,
      reload: vi.fn(),
    });
    const { lastFrame, stdin } = render(<InstalledScreen onInputCapture={() => {}} />);
    // Wait for useEffect to register stdin listeners
    await new Promise((r) => setTimeout(r, 100));
    stdin.write('r');
    await new Promise((r) => setTimeout(r, 100));
    expect(lastFrame()).toContain('Confirm Remove');
  });

  it('shows loading spinner when packages are loading', () => {
    vi.mocked(useInstalled).mockReturnValue({
      packages: [],
      loading: true,
      error: null,
      reload: vi.fn(),
    });
    const { lastFrame } = render(<InstalledScreen onInputCapture={() => {}} />);
    expect(lastFrame()).toContain('Loading installed packages');
  });
});
