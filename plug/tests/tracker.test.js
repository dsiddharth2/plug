import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-tracker-test-${Date.now()}`);
// Local scope: cwd/.plugvault/installed.json — mock getInstalledFilePath
const localInstalled = path.join(tmpDir, 'local', '.plugvault', 'installed.json');
const globalInstalled = path.join(tmpDir, 'global', '.plugvault', 'installed.json');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getInstalledFilePath: (global = false) =>
      global ? globalInstalled : localInstalled,
    ensureDir: actual.ensureDir,
  };
});

const { getInstalled, trackInstall, trackRemove, isInstalled, addDependents, getInstalledRecord, prunableOrphans, removeDependentEdge } = await import('../src/utils/tracker.js');

describe('tracker utils', () => {
  beforeEach(async () => {
    await fs.mkdir(path.dirname(localInstalled), { recursive: true });
    await fs.mkdir(path.dirname(globalInstalled), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('getInstalled returns empty when no file exists', async () => {
    const data = await getInstalled(false);
    expect(data).toEqual({ installed: {} });
  });

  it('trackInstall adds a package to installed.json', async () => {
    await trackInstall('code-review', { type: 'command', vault: 'official', version: '1.0.0', path: '/some/path' }, false);
    const data = await getInstalled(false);
    expect(data.installed['code-review']).toBeDefined();
    expect(data.installed['code-review'].type).toBe('command');
    expect(data.installed['code-review'].vault).toBe('official');
    expect(data.installed['code-review'].installedAt).toBeDefined();
  });

  it('trackInstall uses provided installedAt if given', async () => {
    const ts = '2024-01-01T00:00:00.000Z';
    await trackInstall('code-review', { type: 'command', vault: 'official', version: '1.0.0', path: '/p', installedAt: ts }, false);
    const data = await getInstalled(false);
    expect(data.installed['code-review'].installedAt).toBe(ts);
  });

  it('isInstalled returns false when not tracked', async () => {
    expect(await isInstalled('unknown', false)).toBe(false);
  });

  it('isInstalled returns true after trackInstall', async () => {
    await trackInstall('api-patterns', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p' }, false);
    expect(await isInstalled('api-patterns', false)).toBe(true);
  });

  it('trackRemove removes a package', async () => {
    await trackInstall('code-review', { type: 'command', vault: 'official', version: '1.0.0', path: '/p' }, false);
    await trackRemove('code-review', false);
    expect(await isInstalled('code-review', false)).toBe(false);
  });

  it('trackRemove on non-existent package does not throw', async () => {
    await expect(trackRemove('nonexistent', false)).resolves.not.toThrow();
  });

  it('getInstalled backs up and resets corrupt installed.json', async () => {
    await fs.writeFile(localInstalled, '{ broken json !!!', 'utf8');
    const data = await getInstalled(false);
    expect(data).toEqual({ installed: {} });
    const stat = await fs.stat(localInstalled + '.bak');
    expect(stat.isFile()).toBe(true);
  });

  it('global scope writes to separate file', async () => {
    await trackInstall('code-review', { type: 'command', vault: 'official', version: '1.0.0', path: '/p' }, true);
    expect(await isInstalled('code-review', true)).toBe(true);
    expect(await isInstalled('code-review', false)).toBe(false);
  });

  it('trackInstall with installed_as: dependency persists correctly', async () => {
    await trackInstall('dep-pkg', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', installed_as: 'dependency' }, false);
    const data = await getInstalled(false);
    expect(data.installed['dep-pkg'].installed_as).toBe('dependency');
    expect(data.installed['dep-pkg'].dependencies).toEqual([]);
    expect(data.installed['dep-pkg'].dependents).toEqual([]);
  });

  it('trackInstall without installed_as defaults to explicit', async () => {
    await trackInstall('explicit-pkg', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p' }, false);
    const data = await getInstalled(false);
    expect(data.installed['explicit-pkg'].installed_as).toBe('explicit');
  });

  it('addDependents appends to existing dependents (multi-parent accumulation)', async () => {
    await trackInstall('shared-dep', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', dependents: ['pkg-a'] }, false);
    await addDependents('shared-dep', ['pkg-b'], false);
    const rec = await getInstalledRecord('shared-dep', false);
    expect(rec.dependents).toEqual(['pkg-a', 'pkg-b']);
  });

  it('addDependents deduplicates (calling twice with same name produces no duplicate)', async () => {
    await trackInstall('dedup-dep', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', dependents: ['pkg-a'] }, false);
    await addDependents('dedup-dep', ['pkg-a'], false);
    await addDependents('dedup-dep', ['pkg-a'], false);
    const rec = await getInstalledRecord('dedup-dep', false);
    expect(rec.dependents).toEqual(['pkg-a']);
  });

  it('addDependents mutates only the targeted record (other records unaffected)', async () => {
    await trackInstall('target-dep', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', dependents: [] }, false);
    await trackInstall('other-pkg', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', dependents: [] }, false);
    await addDependents('target-dep', ['pkg-a'], false);
    const other = await getInstalledRecord('other-pkg', false);
    expect(other.dependents).toEqual([]);
  });

  it('prunableOrphans returns packages with installed_as=dependency and no dependents', async () => {
    await trackInstall('orphan-dep', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', installed_as: 'dependency', dependents: [] }, false);
    await trackInstall('needed-dep', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', installed_as: 'dependency', dependents: ['parent'] }, false);
    await trackInstall('explicit-root', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', installed_as: 'explicit', dependents: [] }, false);
    const orphans = await prunableOrphans(false);
    expect(orphans).toContain('orphan-dep');
    expect(orphans).not.toContain('needed-dep');
    expect(orphans).not.toContain('explicit-root');
  });

  it('removeDependentEdge removes back-reference correctly', async () => {
    await trackInstall('dep-with-ref', { type: 'skill', vault: 'official', version: '1.0.0', path: '/p', dependents: ['parent-a', 'parent-b'] }, false);
    await removeDependentEdge('parent-a', 'dep-with-ref', false);
    const rec = await getInstalledRecord('dep-with-ref', false);
    expect(rec.dependents).toEqual(['parent-b']);
  });
});
