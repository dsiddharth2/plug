import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import TabBar from '../../src/tui/components/tab-bar.jsx';

describe('TabBar', () => {
  it('renders all three tab labels', () => {
    const { lastFrame } = render(<TabBar activeTab={0} />);
    const frame = lastFrame();
    expect(frame).toContain('Discover');
    expect(frame).toContain('Installed');
    expect(frame).toContain('Vaults');
  });

  it('wraps active tab label in brackets', () => {
    const { lastFrame } = render(<TabBar activeTab={1} />);
    expect(lastFrame()).toContain('[ Installed ]');
  });

  it('updates active tab indicator when activeTab prop changes', () => {
    const { lastFrame, rerender } = render(<TabBar activeTab={0} />);
    expect(lastFrame()).toContain('[ Discover ]');
    rerender(<TabBar activeTab={2} />);
    expect(lastFrame()).toContain('[ Vaults ]');
  });
});
