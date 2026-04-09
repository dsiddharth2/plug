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

const { getInstalled, trackInstall, trackRemove, isInstalled } = await import('../src/utils/tracker.js');

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
});
