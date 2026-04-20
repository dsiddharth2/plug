import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';

// Mock network-dependent hooks before importing the screen
vi.mock('../../src/tui/hooks/use-packages.js', () => ({
  usePackages: vi.fn(() => ({
    packages: [],
    loading: false,
    error: null,
    warning: null,
  })),
}));

vi.mock('../../src/utils/tracker.js', () => ({
  getInstalled: vi.fn(async () => ({ installed: {} })),
}));

vi.mock('../../src/commands/install.js', () => ({
  runInstall: vi.fn(async () => {}),
}));

vi.mock('../../src/utils/resolver.js', () => ({
  resolve: vi.fn(async () => ({ toInstall: [], alreadySatisfied: [], cycles: [] })),
}));

vi.mock('../../src/utils/context.js', () => ({
  ctx: { set: vi.fn() },
}));

// Import after mocks are registered
const { default: DiscoverScreen } = await import('../../src/tui/screens/discover.jsx');
const { default: PackageDetail } = await import('../../src/tui/components/package-detail.jsx');
const { usePackages } = await import('../../src/tui/hooks/use-packages.js');
const { resolve } = await import('../../src/utils/resolver.js');

const MOCK_PACKAGES = [
  { name: 'code-review', vault: 'official', version: '1.0.0', type: 'command', description: 'Review code' },
  { name: 'test-gen', vault: 'official', version: '1.1.0', type: 'skill', description: 'Generate tests' },
];

const MOCK_COMMUNITY_PACKAGES = [
  {
    name: 'agent-fleet',
    vault: 'community',
    version: '1.0.0',
    type: 'agent',
    description: 'Fleet management agent',
    source: 'community',
    depCount: 3,
    dependencies: [
      { name: 'dep-one', vault: 'community', required: true },
      { name: 'dep-two', vault: 'community', required: true },
      { name: 'dep-three', vault: 'community', required: false },
    ],
    tags: ['agents'],
    path: 'community/agent-fleet',
    rawBaseUrl: 'https://raw.githubusercontent.com/example/vault/main',
  },
  {
    name: 'simple-tool',
    vault: 'community',
    version: '0.1.0',
    type: 'command',
    description: 'Simple tool with no dependencies',
    source: 'community',
    depCount: 0,
    dependencies: [],
    tags: [],
    path: 'community/simple-tool',
    rawBaseUrl: 'https://raw.githubusercontent.com/example/vault/main',
  },
];

describe('DiscoverScreen', () => {
  beforeEach(() => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [],
      loading: false,
      error: null,
      warning: null,
    });
  });

  it('shows loading spinner while packages load', () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [],
      loading: true,
      error: null,
      warning: null,
    });
    const { lastFrame } = render(<DiscoverScreen onInputCapture={() => {}} />);
    expect(lastFrame()).toContain('Fetching packages');
  });

  it('renders community and official packages in list', () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [...MOCK_PACKAGES, ...MOCK_COMMUNITY_PACKAGES],
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame } = render(<DiscoverScreen onInputCapture={() => {}} />);
    const frame = lastFrame();
    expect(frame).toContain('code-review');
    expect(frame).toContain('agent-fleet');
  });

  it('shows empty message when search has no matches', async () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: MOCK_PACKAGES,
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame, stdin } = render(<DiscoverScreen onInputCapture={() => {}} />);
    await new Promise((r) => setTimeout(r, 100));

    stdin.write('/');
    await new Promise((r) => setTimeout(r, 100));

    stdin.write('z');
    stdin.write('z');
    stdin.write('z');
    await new Promise((r) => setTimeout(r, 100));

    expect(lastFrame()).toContain('No results for');
  });

  // ── PackageDetail ─────────────────────────────────────────────────────────

  it('detail view shows metadata and install hint', () => {
    const { lastFrame } = render(
      <PackageDetail
        pkg={MOCK_COMMUNITY_PACKAGES[0]}
        onBack={() => {}}
        onInstall={() => {}}
        installedNames={new Set()}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain('agent-fleet');
    expect(frame).toContain('[agent]');
    expect(frame).toContain('[i]');
  });

  it('detail view shows installed badge when already installed', () => {
    const { lastFrame } = render(
      <PackageDetail
        pkg={MOCK_COMMUNITY_PACKAGES[0]}
        onBack={() => {}}
        onInstall={() => {}}
        installedNames={new Set(['agent-fleet'])}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain('✓ installed');
    expect(frame).not.toContain('[i]');
  });

  // ── Plan view ─────────────────────────────────────────────────────────────

  it('shows plan view with scope selector on install', async () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [MOCK_COMMUNITY_PACKAGES[0]],
      loading: false,
      error: null,
      warning: null,
    });
    vi.mocked(resolve).mockResolvedValueOnce({
      toInstall: ['dep-one', 'agent-fleet'],
      alreadySatisfied: [],
      cycles: [],
    });

    const { lastFrame, stdin } = render(<DiscoverScreen onInputCapture={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));

    stdin.write('i');
    await new Promise((r) => setTimeout(r, 200));

    const frame = lastFrame();
    expect(frame).toContain('Will install');
    expect(frame).toContain('◉ Project');
  });

  it('Tab toggles scope, Esc cancels plan view', async () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [MOCK_COMMUNITY_PACKAGES[0]],
      loading: false,
      error: null,
      warning: null,
    });
    vi.mocked(resolve).mockResolvedValueOnce({
      toInstall: ['dep-one', 'agent-fleet'],
      alreadySatisfied: [],
      cycles: [],
    });

    const { lastFrame, stdin } = render(<DiscoverScreen onInputCapture={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));

    stdin.write('i');
    await new Promise((r) => setTimeout(r, 200));

    stdin.write('\t');
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain('◉ Global');

    stdin.write('\x1B');
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame()).toContain('agent-fleet');
    expect(lastFrame()).not.toContain('Will install');
  });
});
