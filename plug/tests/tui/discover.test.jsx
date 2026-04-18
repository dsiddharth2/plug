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

  it('shows zero-search-results message when filter has no matches', async () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: MOCK_PACKAGES,
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame, stdin } = render(<DiscoverScreen onInputCapture={() => {}} />);

    // Wait for useEffect to register stdin listeners
    await new Promise((r) => setTimeout(r, 100));

    // Activate search with '/' and wait for focus state to propagate
    stdin.write('/');
    await new Promise((r) => setTimeout(r, 100));

    // Type a query that won't match anything
    stdin.write('z');
    stdin.write('z');
    stdin.write('z');
    await new Promise((r) => setTimeout(r, 100));

    const frame = lastFrame();
    // Should show the no-results empty message
    expect(frame).toContain('No results for');
  });

  // ── Community package rendering ─────────────────────────────────────────

  it('renders community packages without error', () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: MOCK_COMMUNITY_PACKAGES,
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame } = render(<DiscoverScreen onInputCapture={() => {}} />);
    const frame = lastFrame();
    expect(frame).toContain('agent-fleet');
    expect(frame).toContain('simple-tool');
  });

  it('shows "★ 3 deps" for a package with depCount: 3', () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [MOCK_COMMUNITY_PACKAGES[0]],
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame } = render(<DiscoverScreen onInputCapture={() => {}} />);
    expect(lastFrame()).toContain('★ 3 deps');
  });

  it('shows "no deps" for a package with depCount: 0', () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [MOCK_COMMUNITY_PACKAGES[1]],
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame } = render(<DiscoverScreen onInputCapture={() => {}} />);
    expect(lastFrame()).toContain('no deps');
  });

  it('official packages still visible when community fetch would fail (community failure isolated)', () => {
    // Simulates usePackages state after an isolated community fetch failure:
    // community catch block swallows the error; only official packages in state.
    vi.mocked(usePackages).mockReturnValue({
      packages: MOCK_PACKAGES,
      loading: false,
      error: null,
      warning: null,
    });
    const { lastFrame } = render(<DiscoverScreen onInputCapture={() => {}} />);
    const frame = lastFrame();
    expect(frame).toContain('code-review');
    expect(frame).toContain('test-gen');
  });

  // ── PackageDetail — dep list rendering ──────────────────────────────────

  it('detail view: renders ✓ installed for installed deps, "not installed" for absent', () => {
    const pkg = MOCK_COMMUNITY_PACKAGES[0]; // agent-fleet with 3 deps
    const installedNames = new Set(['dep-one']); // only dep-one is installed
    const { lastFrame } = render(
      <PackageDetail
        pkg={pkg}
        onBack={() => {}}
        onInstall={() => {}}
        installedNames={installedNames}
      />
    );
    const frame = lastFrame();
    // dep-one is installed
    expect(frame).toContain('dep-one');
    expect(frame).toContain('✓ installed');
    // dep-two and dep-three are not installed
    expect(frame).toContain('dep-two');
    expect(frame).toContain('not installed');
  });

  // ── Plan view ──────────────────────────────────────────────────────────────

  it('shows plan view when package has deps (toInstall.length > 1)', async () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [MOCK_COMMUNITY_PACKAGES[0]], // agent-fleet with deps
      loading: false,
      error: null,
      warning: null,
    });
    // Resolver returns multiple packages → plan screen should show
    vi.mocked(resolve).mockResolvedValueOnce({
      toInstall: ['dep-one', 'agent-fleet'],
      alreadySatisfied: [],
      cycles: [],
    });

    const { lastFrame, stdin } = render(<DiscoverScreen onInputCapture={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));

    // Press 'i' to start install
    stdin.write('i');
    await new Promise((r) => setTimeout(r, 200));

    const frame = lastFrame();
    expect(frame).toContain('Will install');
  });

  it('skips plan view for a no-dep package (installs immediately)', async () => {
    vi.mocked(usePackages).mockReturnValue({
      packages: [MOCK_COMMUNITY_PACKAGES[1]], // simple-tool with no deps
      loading: false,
      error: null,
      warning: null,
    });
    // Resolver returns only root → skip plan screen
    vi.mocked(resolve).mockResolvedValueOnce({
      toInstall: ['simple-tool'],
      alreadySatisfied: [],
      cycles: [],
    });

    const { runInstall } = await import('../../src/commands/install.js');
    vi.mocked(runInstall).mockResolvedValue(undefined);

    const { lastFrame, stdin } = render(<DiscoverScreen onInputCapture={() => {}} />);
    await new Promise((r) => setTimeout(r, 50));

    stdin.write('i');
    await new Promise((r) => setTimeout(r, 200));

    // Should now show plan view with scope selector even for single package
    const frame = lastFrame();
    expect(frame).toContain('Will install');
    expect(frame).toContain('Project');
  });

  it('Tab key toggles scope between Project and Global in plan view', async () => {
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

    // Default scope is project
    expect(lastFrame()).toContain('◉ Project');

    // Tab toggles to global
    stdin.write('\t');
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame()).toContain('◉ Global');
  });

  it('Esc in plan view returns to list', async () => {
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

    // Plan view is showing
    expect(lastFrame()).toContain('Will install');

    // Esc cancels back to list
    stdin.write('\x1B');
    await new Promise((r) => setTimeout(r, 50));

    expect(lastFrame()).toContain('agent-fleet');
    expect(lastFrame()).not.toContain('Will install');
  });

  it('"Installing this will also install" shows only uninstalled required deps', () => {
    const pkg = {
      ...MOCK_COMMUNITY_PACKAGES[0],
      // dep-one (required), dep-two (required), dep-three (optional)
      // dep-one is already installed → only dep-two should appear in the notice
    };
    const installedNames = new Set(['dep-one']); // dep-one already installed
    const { lastFrame } = render(
      <PackageDetail
        pkg={pkg}
        onBack={() => {}}
        onInstall={() => {}}
        installedNames={installedNames}
      />
    );
    const frame = lastFrame();
    expect(frame).toContain('Installing this will also install');
    // Find the specific "also install" line and verify its exact contents
    const alsoInstallLine = frame.split('\n').find(l => l.includes('Installing this will also install'));
    // dep-two is required and not installed → must appear
    expect(alsoInstallLine).toContain('dep-two');
    // dep-one is already installed → must NOT appear in the "also install" notice
    expect(alsoInstallLine).not.toContain('dep-one');
    // dep-three is optional (required: false) → must NOT appear in the "also install" notice
    expect(alsoInstallLine).not.toContain('dep-three');
  });
});
