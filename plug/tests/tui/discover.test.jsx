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

vi.mock('../../src/utils/context.js', () => ({
  ctx: { set: vi.fn() },
}));

// Import after mocks are registered
const { default: DiscoverScreen } = await import('../../src/tui/screens/discover.jsx');
const { usePackages } = await import('../../src/tui/hooks/use-packages.js');

const MOCK_PACKAGES = [
  { name: 'code-review', vault: 'official', version: '1.0.0', type: 'command', description: 'Review code' },
  { name: 'test-gen', vault: 'official', version: '1.1.0', type: 'skill', description: 'Generate tests' },
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
});
