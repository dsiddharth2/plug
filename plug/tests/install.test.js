import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-install-test-${Date.now()}`);
const localSkillsDir = path.join(tmpDir, '.claude', 'skills');
const localCommandsDir = path.join(tmpDir, '.claude', 'commands');
const globalSkillsDir = path.join(tmpDir, 'global', '.claude', 'skills');
const globalCommandsDir = path.join(tmpDir, 'global', '.claude', 'commands');
const localInstalledFile = path.join(tmpDir, '.plugvault', 'installed.json');
const globalInstalledFile = path.join(tmpDir, 'global', '.plugvault', 'installed.json');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeSkillsDir: (global = false) =>
      global ? globalSkillsDir : localSkillsDir,
    getClaudeCommandsDir: (global = false) =>
      global ? globalCommandsDir : localCommandsDir,
    getInstalledFilePath: (global = false) =>
      global ? globalInstalledFile : localInstalledFile,
    ensureDir: actual.ensureDir,
  };
});

const sampleVault = { name: 'official', owner: 'plugvault', repo: 'plugvault', branch: 'main', private: false };

const samplePkg = {
  name: 'code-review',
  type: 'command',
  version: '1.0.0',
  path: 'registry/code-review',
  description: 'Deep code review',
};

const sampleSkillPkg = {
  name: 'api-patterns',
  type: 'skill',
  version: '1.0.0',
  path: 'registry/api-patterns',
  description: 'API patterns skill',
};

const sampleMeta = {
  name: 'code-review',
  type: 'command',
  version: '1.0.0',
  entry: 'code-review.md',
};

const sampleSkillMeta = {
  name: 'api-patterns',
  type: 'skill',
  version: '1.0.0',
  entry: 'api-patterns.md',
};

vi.mock('../src/utils/registry.js', () => ({
  findPackage: vi.fn(),
  findAllPackages: vi.fn(),
}));

vi.mock('../src/utils/fetcher.js', () => ({
  downloadFile: vi.fn(),
}));

vi.mock('../src/utils/tracker.js', () => ({
  trackInstall: vi.fn(),
  isInstalled: vi.fn(),
}));

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
}));

const { findPackage, findAllPackages } = await import('../src/utils/registry.js');
const { downloadFile } = await import('../src/utils/fetcher.js');
const { trackInstall, isInstalled } = await import('../src/utils/tracker.js');
const { confirm, select } = await import('@inquirer/prompts');
const { runInstall } = await import('../src/commands/install.js');

describe('plug install', () => {
  beforeEach(async () => {
    await fs.mkdir(localSkillsDir, { recursive: true });
    await fs.mkdir(localCommandsDir, { recursive: true });
    await fs.mkdir(path.dirname(localInstalledFile), { recursive: true });

    // Default: not installed, no conflicts
    isInstalled.mockResolvedValue(false);
    findAllPackages.mockResolvedValue([{ pkg: samplePkg, vault: sampleVault }]);
    findPackage.mockResolvedValue({ pkg: samplePkg, vault: sampleVault });
    downloadFile
      .mockResolvedValueOnce(JSON.stringify(sampleMeta))  // meta.json
      .mockResolvedValueOnce('# code-review content');    // entry file
    trackInstall.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('installs a command to .claude/commands/', async () => {
    await runInstall('code-review', {});

    const destPath = path.join(localCommandsDir, 'code-review.md');
    const content = await fs.readFile(destPath, 'utf8');
    expect(content).toBe('# code-review content');

    expect(trackInstall).toHaveBeenCalledWith(
      'code-review',
      expect.objectContaining({ type: 'command', vault: 'official' }),
      false,
    );
  });

  it('installs a skill to .claude/skills/', async () => {
    findAllPackages.mockResolvedValue([{ pkg: sampleSkillPkg, vault: sampleVault }]);
    downloadFile
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify(sampleSkillMeta))
      .mockResolvedValueOnce('# api-patterns content');

    await runInstall('api-patterns', {});

    const destPath = path.join(localSkillsDir, 'api-patterns.md');
    const content = await fs.readFile(destPath, 'utf8');
    expect(content).toBe('# api-patterns content');

    expect(trackInstall).toHaveBeenCalledWith(
      'api-patterns',
      expect.objectContaining({ type: 'skill', vault: 'official' }),
      false,
    );
  });

  it('installs globally with -g flag', async () => {
    await fs.mkdir(globalSkillsDir, { recursive: true });
    await fs.mkdir(globalCommandsDir, { recursive: true });

    await runInstall('code-review', { global: true });

    const destPath = path.join(globalCommandsDir, 'code-review.md');
    const content = await fs.readFile(destPath, 'utf8');
    expect(content).toBe('# code-review content');

    expect(trackInstall).toHaveBeenCalledWith(
      'code-review',
      expect.objectContaining({ type: 'command' }),
      true,
    );
  });

  it('uses vault prefix to resolve specific vault', async () => {
    findPackage.mockResolvedValue({ pkg: samplePkg, vault: sampleVault });

    await runInstall('official/code-review', {});

    expect(findPackage).toHaveBeenCalledWith('code-review', 'official');
    expect(findAllPackages).not.toHaveBeenCalled();
  });

  it('throws when package not found in any vault', async () => {
    findAllPackages.mockResolvedValue([]);

    await expect(runInstall('nonexistent', {})).rejects.toThrow(
      "Package 'nonexistent' not found in any vault.",
    );
  });

  it('throws when vault-prefix package not found', async () => {
    findPackage.mockResolvedValue(null);

    await expect(runInstall('official/nonexistent', {})).rejects.toThrow(
      "Package 'nonexistent' not found in vault 'official'.",
    );
  });

  it('prompts for vault when name exists in multiple vaults', async () => {
    const vault2 = { name: 'community', owner: 'community', repo: 'plugvault', branch: 'main' };
    findAllPackages.mockResolvedValue([
      { pkg: samplePkg, vault: sampleVault },
      { pkg: { ...samplePkg, description: 'Community version' }, vault: vault2 },
    ]);
    select.mockResolvedValue({ pkg: samplePkg, vault: sampleVault });

    await runInstall('code-review', {});

    expect(select).toHaveBeenCalledOnce();
    expect(trackInstall).toHaveBeenCalledWith(
      'code-review',
      expect.objectContaining({ vault: 'official' }),
      false,
    );
  });

  it('prompts overwrite when already installed and proceeds on confirm', async () => {
    isInstalled.mockResolvedValue(true);
    confirm.mockResolvedValue(true);

    await runInstall('code-review', {});

    expect(confirm).toHaveBeenCalledOnce();
    expect(trackInstall).toHaveBeenCalledOnce();
  });

  it('aborts when already installed and user declines overwrite', async () => {
    isInstalled.mockResolvedValue(true);
    confirm.mockResolvedValue(false);

    await runInstall('code-review', {});

    expect(trackInstall).not.toHaveBeenCalled();
  });

  it('falls back to registry data when meta.json fetch fails', async () => {
    downloadFile
      .mockReset()
      .mockRejectedValueOnce(new Error('meta.json not found'))
      .mockResolvedValueOnce('# code-review fallback content');

    await runInstall('code-review', {});

    // Should still install using fallback meta (type from registry pkg)
    const destPath = path.join(localCommandsDir, 'code-review.md');
    const content = await fs.readFile(destPath, 'utf8');
    expect(content).toBe('# code-review fallback content');
  });

  it('auto-creates .claude/ directories if they do not exist', async () => {
    // Remove directories to simulate fresh project
    await fs.rm(localSkillsDir, { recursive: true, force: true });
    await fs.rm(localCommandsDir, { recursive: true, force: true });

    await runInstall('code-review', {});

    const stat = await fs.stat(localCommandsDir);
    expect(stat.isDirectory()).toBe(true);
  });
});
