import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/utils/registry.js', () => ({
  fetchRegistry: vi.fn(),
  getStaleRegistryCache: vi.fn(),
}));

vi.mock('../src/utils/community-index.js', () => ({
  fetchCommunityIndex: vi.fn(),
  getStaleCommunityIndexCache: vi.fn(),
}));

vi.mock('../src/utils/tracker.js', () => ({
  getInstalled: vi.fn(),
}));

vi.mock('../src/utils/config.js', () => ({
  getResolveOrder: vi.fn(),
}));

import { resolve } from '../src/utils/resolver.js';
import { fetchRegistry, getStaleRegistryCache } from '../src/utils/registry.js';
import { fetchCommunityIndex, getStaleCommunityIndexCache } from '../src/utils/community-index.js';
import { getInstalled } from '../src/utils/tracker.js';
import { getResolveOrder } from '../src/utils/config.js';

function makeRegistry(packages) {
  return { packages };
}

function makeInstalled(names) {
  const installed = {};
  for (const n of names) installed[n] = { type: 'skill', vault: 'official', version: '1.0.0' };
  return { installed };
}

beforeEach(() => {
  vi.resetAllMocks();
  getResolveOrder.mockResolvedValue([]);
  fetchRegistry.mockRejectedValue(new Error('no vault'));
  getStaleRegistryCache.mockResolvedValue(null);
  fetchCommunityIndex.mockRejectedValue(new Error('offline'));
  getStaleCommunityIndexCache.mockResolvedValue(null);
  getInstalled.mockResolvedValue(makeInstalled([]));
});

function setupPackages(packages) {
  fetchCommunityIndex.mockResolvedValue({ packages });
}

describe('resolver', () => {
  it('no deps → toInstall: [pkg], alreadySatisfied: [], cycles: []', async () => {
    setupPackages([{ name: 'senior-engineer', dependencies: [] }]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    const result = await resolve('senior-engineer');

    expect(result.toInstall).toEqual(['senior-engineer']);
    expect(result.alreadySatisfied).toEqual([]);
    expect(result.cycles).toEqual([]);
  });

  it('single required dep → toInstall: [dep, pkg] (dep first)', async () => {
    setupPackages([
      { name: 'pkg-a', dependencies: [{ name: 'dep-x', required: true }] },
      { name: 'dep-x', dependencies: [] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    const result = await resolve('pkg-a');

    expect(result.toInstall).toEqual(['dep-x', 'pkg-a']);
    expect(result.alreadySatisfied).toEqual([]);
  });

  it('dep already installed → alreadySatisfied: [dep], toInstall: [pkg]', async () => {
    setupPackages([
      { name: 'pkg-b', dependencies: [{ name: 'dep-y', required: true }] },
      { name: 'dep-y', dependencies: [] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled(['dep-y']));

    const result = await resolve('pkg-b');

    expect(result.toInstall).toEqual(['pkg-b']);
    expect(result.alreadySatisfied).toEqual(['dep-y']);
  });

  it('transitive A→B→C → toInstall: [C, B, A]', async () => {
    setupPackages([
      { name: 'pkg-A', dependencies: [{ name: 'pkg-B', required: true }] },
      { name: 'pkg-B', dependencies: [{ name: 'pkg-C', required: true }] },
      { name: 'pkg-C', dependencies: [] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    const result = await resolve('pkg-A');

    expect(result.toInstall).toEqual(['pkg-C', 'pkg-B', 'pkg-A']);
  });

  it('cycle A→B→A → cycles: [A], toInstall contains B and A', async () => {
    setupPackages([
      { name: 'cyc-A', dependencies: [{ name: 'cyc-B', required: true }] },
      { name: 'cyc-B', dependencies: [{ name: 'cyc-A', required: true }] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    const result = await resolve('cyc-A');

    expect(result.cycles).toContain('cyc-A');
    expect(result.toInstall).toContain('cyc-B');
    expect(result.toInstall).toContain('cyc-A');
  });

  it('optional dep (required: false) NOT added to toInstall', async () => {
    setupPackages([
      { name: 'pkg-opt', dependencies: [{ name: 'opt-dep', required: false }] },
      { name: 'opt-dep', dependencies: [] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    const result = await resolve('pkg-opt');

    expect(result.toInstall).toEqual(['pkg-opt']);
    expect(result.toInstall).not.toContain('opt-dep');
  });

  it('unknown package in deps → silently skipped, no crash', async () => {
    setupPackages([
      { name: 'pkg-unknown-dep', dependencies: [{ name: 'ghost-pkg', required: true }] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    const result = await resolve('pkg-unknown-dep');

    expect(result.toInstall).toEqual(['pkg-unknown-dep']);
    expect(result.cycles).toEqual([]);
  });

  it('all deps already installed → toInstall: [pkg], alreadySatisfied: [all deps]', async () => {
    setupPackages([
      { name: 'pkg-all-installed', dependencies: [{ name: 'dep-1', required: true }, { name: 'dep-2', required: true }] },
      { name: 'dep-1', dependencies: [] },
      { name: 'dep-2', dependencies: [] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled(['dep-1', 'dep-2']));

    const result = await resolve('pkg-all-installed');

    expect(result.toInstall).toEqual(['pkg-all-installed']);
    expect(result.alreadySatisfied).toContain('dep-1');
    expect(result.alreadySatisfied).toContain('dep-2');
  });

  it('getInstalled called exactly once per resolve() invocation (even for multi-dep graphs)', async () => {
    setupPackages([
      { name: 'root-pkg', dependencies: [{ name: 'dep-m1', required: true }, { name: 'dep-m2', required: true }] },
      { name: 'dep-m1', dependencies: [{ name: 'dep-m2', required: true }] },
      { name: 'dep-m2', dependencies: [] },
    ]);
    getInstalled.mockResolvedValue(makeInstalled([]));

    await resolve('root-pkg');

    expect(getInstalled).toHaveBeenCalledTimes(1);
  });
});
