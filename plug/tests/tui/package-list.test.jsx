import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import PackageList from '../../src/tui/components/package-list.jsx';

const MOCK_ITEMS = [
  { name: 'alpha', vault: 'official', version: '1.0.0', type: 'skill', description: 'Alpha desc' },
  { name: 'beta', vault: 'official', version: '2.0.0', type: 'command', description: 'Beta desc' },
  { name: 'gamma', vault: 'official', version: '3.0.0', type: 'agent', description: 'Gamma desc' },
];

describe('PackageList', () => {
  it('shows default empty message when no items', () => {
    const { lastFrame } = render(<PackageList items={[]} />);
    expect(lastFrame()).toContain('No packages found.');
  });

  it('shows custom emptyMessage when no items', () => {
    const { lastFrame } = render(
      <PackageList items={[]} emptyMessage="No results for 'foo'." />
    );
    expect(lastFrame()).toContain("No results for 'foo'.");
  });

  it('renders package names and descriptions', () => {
    const { lastFrame } = render(<PackageList items={MOCK_ITEMS} />);
    const frame = lastFrame();
    expect(frame).toContain('alpha');
    expect(frame).toContain('beta');
    expect(frame).toContain('Alpha desc');
  });

  it('shows cursor marker on first item', () => {
    const { lastFrame } = render(<PackageList items={MOCK_ITEMS} />);
    expect(lastFrame()).toContain('>');
  });

  it('moves cursor down on down-arrow key', async () => {
    const { lastFrame, frames, stdin } = render(<PackageList items={MOCK_ITEMS} />);
    const framesBefore = frames.length;
    // Wait for useEffect to register stdin listener
    await new Promise((r) => setTimeout(r, 100));
    stdin.write('\x1B[B'); // down arrow
    await new Promise((r) => setTimeout(r, 100));
    // Should have re-rendered after cursor moved
    expect(frames.length).toBeGreaterThan(framesBefore);
    expect(lastFrame()).toContain('beta');
  });

  it('shows scroll-down indicator when items exceed viewport', () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      name: `pkg-${String(i).padStart(2, '0')}`,
      vault: 'official',
      version: '1.0.0',
      type: 'skill',
      description: `Package ${i}`,
    }));
    const { lastFrame } = render(<PackageList items={manyItems} viewportHeight={4} />);
    expect(lastFrame()).toContain('↓');
  });
});
