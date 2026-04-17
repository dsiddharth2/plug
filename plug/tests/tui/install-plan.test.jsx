import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import InstallPlan from '../../src/tui/components/install-plan.jsx';

describe('InstallPlan', () => {
  const queue = [{ name: 'code-reviewer', vault: 'superpowers', type: 'skill' }];
  const plan = { toInstall: ['code-reviewer'], alreadySatisfied: [], cycles: [] };

  it('renders correctly with installation plan', () => {
    const { lastFrame } = render(
      <InstallPlan queue={queue} plan={plan} loading={false} onConfirm={() => {}} onCancel={() => {}} />
    );
    const frame = lastFrame();
    expect(frame).toContain('Will install (1)');
    expect(frame).toContain('code-reviewer');
    expect(frame).toContain('Project (.claude/)');
    expect(frame).toContain('Global (~/.claude/)');
  });

  it('toggles scope on right arrow', async () => {
    const { lastFrame, stdin } = render(
      <InstallPlan queue={queue} plan={plan} loading={false} onConfirm={() => {}} onCancel={() => {}} />
    );

    // Initial state: Project is selected
    expect(lastFrame()).toContain('◉ Project');
    expect(lastFrame()).toContain('○ Global');

    // Wait for useInput to register
    await new Promise((r) => setTimeout(r, 100));

    // Press right arrow
    stdin.write('\x1B[C');
    await new Promise((r) => setTimeout(r, 100));

    expect(lastFrame()).toContain('○ Project');
    expect(lastFrame()).toContain('◉ Global');
  });

  it('toggles scope on left arrow', async () => {
    const { lastFrame, stdin } = render(
      <InstallPlan queue={queue} plan={plan} loading={false} onConfirm={() => {}} onCancel={() => {}} />
    );

    // Initial state: Project is selected
    expect(lastFrame()).toContain('◉ Project');

    // Wait for useInput to register
    await new Promise((r) => setTimeout(r, 100));

    // Press left arrow
    stdin.write('\x1B[D');
    await new Promise((r) => setTimeout(r, 100));

    expect(lastFrame()).toContain('○ Project');
    expect(lastFrame()).toContain('◉ Global');
  });

  it('toggles scope on Tab', async () => {
    const { lastFrame, stdin } = render(
      <InstallPlan queue={queue} plan={plan} loading={false} onConfirm={() => {}} onCancel={() => {}} />
    );

    expect(lastFrame()).toContain('◉ Project');

    // Wait for useInput to register
    await new Promise((r) => setTimeout(r, 100));

    // Press Tab
    stdin.write('\t');
    await new Promise((r) => setTimeout(r, 100));

    expect(lastFrame()).toContain('○ Project');
    expect(lastFrame()).toContain('◉ Global');
  });
});
