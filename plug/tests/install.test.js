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

const localAgentsDir = path.join(tmpDir, '.claude', 'agents');
const globalAgentsDir = path.join(tmpDir, 'global', '.claude', 'agents');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeSkillsDir: (global = false) =>
      global ? globalSkillsDir : localSkillsDir,
    getClaudeCommandsDir: (global = false) =>
      global ? globalCommandsDir : localCommandsDir,
    getClaudeAgentsDir: (global = false) =>
      global ? globalAgentsDir : localAgentsDir,
    getClaudeDirForType: (type, global = false) => {
      if (type === 'skill') return global ? globalSkillsDir : localSkillsDir;
      if (type === 'agent') return global ? globalAgentsDir : localAgentsDir;
      return global ? globalCommandsDir : localCommandsDir;
    },
    getInstalledFilePath: (global = false) =>
      global ? globalInstalledFile : localInstalledFile,
    ensureDir: actual.ensureDir,
  };
});

const sampleVault = { name: 'official', owner: 'dsiddharth2', repo: 'plugvault', branch: 'main', private: false };

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

const sampleAgentPkg = {
  name: 'code-agent',
  type: 'agent',
  version: '1.0.0',
  path: 'registry/code-agent',
  description: 'An autonomous coding agent',
};

const sampleAgentMeta = {
  name: 'code-agent',
  type: 'agent',
  version: '1.0.0',
  entry: 'code-agent.md',
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
  getInstalled: vi.fn().mockResolvedValue({ installed: {} }),
}));

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
  select: vi.fn(),
}));

const { findPackage, findAllPackages } = await import('../src/utils/registry.js');
const { downloadFile } = await import('../src/utils/fetcher.js');
const { trackInstall, isInstalled, getInstalled } = await import('../src/utils/tracker.js');
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

  it('installs a skill to .claude/skills/<name>/SKILL.md (per-skill subdir)', async () => {
    findAllPackages.mockResolvedValue([{ pkg: sampleSkillPkg, vault: sampleVault }]);
    downloadFile
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify(sampleSkillMeta))
      .mockResolvedValueOnce('# api-patterns content');

    await runInstall('api-patterns', {});

    const destPath = path.join(localSkillsDir, 'api-patterns', 'SKILL.md');
    const content = await fs.readFile(destPath, 'utf8');
    expect(content).toBe('# api-patterns content');

    expect(trackInstall).toHaveBeenCalledWith(
      'api-patterns',
      expect.objectContaining({
        type: 'skill',
        vault: 'official',
        path: destPath,
      }),
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

  it('installs an agent to .claude/agents/', async () => {
    findAllPackages.mockResolvedValue([{ pkg: sampleAgentPkg, vault: sampleVault }]);
    downloadFile
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify(sampleAgentMeta))
      .mockResolvedValueOnce('# code-agent content');

    await runInstall('code-agent', {});

    const destPath = path.join(localAgentsDir, 'code-agent.md');
    const content = await fs.readFile(destPath, 'utf8');
    expect(content).toBe('# code-agent content');

    expect(trackInstall).toHaveBeenCalledWith(
      'code-agent',
      expect.objectContaining({ type: 'agent', vault: 'official' }),
      false,
    );
  });

  it('displays agent usage message after installing an agent', async () => {
    findAllPackages.mockResolvedValue([{ pkg: sampleAgentPkg, vault: sampleVault }]);
    downloadFile
      .mockReset()
      .mockResolvedValueOnce(JSON.stringify(sampleAgentMeta))
      .mockResolvedValueOnce('# code-agent content');

    const output = [];
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args) => output.push(args.join(' ')));

    await runInstall('code-agent', {});
    consoleSpy.mockRestore();

    const allOutput = output.join('\n');
    expect(allOutput).toContain("The agent 'code-agent' is available for delegation");
  });

  // ── Phase 2: per-skill subdir layout ─────────────────────────────────────────

  it('fresh install of 3 skills produces 3 separate subdirs each with SKILL.md', async () => {
    const skills = [
      { name: 'api-patterns',   content: '# api-patterns'   },
      { name: 'code-style',     content: '# code-style'     },
      { name: 'error-handling', content: '# error-handling' },
    ];

    // Clear beforeEach's queued code-review download values
    downloadFile.mockReset();

    for (const skill of skills) {
      const pkg = { name: skill.name, type: 'skill', version: '1.0.0', path: `registry/${skill.name}`, description: '' };
      const meta = { name: skill.name, type: 'skill', version: '1.0.0', entry: 'SKILL.md' };
      findAllPackages.mockResolvedValueOnce([{ pkg, vault: sampleVault }]);
      downloadFile
        .mockResolvedValueOnce(JSON.stringify(meta))
        .mockResolvedValueOnce(skill.content);

      await runInstall(skill.name, {});
    }

    for (const skill of skills) {
      const skillPath = path.join(localSkillsDir, skill.name, 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf8');
      expect(content).toBe(skill.content);
    }
  });

  it('migrates parseable legacy flat SKILL.md to per-skill subdir on next install', async () => {
    // Set up a legacy flat SKILL.md with parseable frontmatter
    const legacyContent = '---\nname: old-skill\nversion: 1.0.0\n---\n# old-skill content';
    const legacyPath = path.join(localSkillsDir, 'SKILL.md');
    await fs.writeFile(legacyPath, legacyContent, 'utf8');

    // Mock getInstalled to return the old record pointing at legacy path
    getInstalled.mockResolvedValue({
      installed: { 'old-skill': { type: 'skill', vault: 'official', version: '1.0.0', path: legacyPath, installedAt: '2026-01-01T00:00:00.000Z' } },
    });

    // Install a new skill — migration should run first
    const newPkg = { name: 'new-skill', type: 'skill', version: '1.0.0', path: 'registry/new-skill', description: '' };
    const newMeta = { name: 'new-skill', type: 'skill', version: '1.0.0', entry: 'SKILL.md' };
    findAllPackages.mockResolvedValue([{ pkg: newPkg, vault: sampleVault }]);
    downloadFile
      .mockReset()  // clear beforeEach's code-review values
      .mockResolvedValueOnce(JSON.stringify(newMeta))
      .mockResolvedValueOnce('# new-skill content');

    await runInstall('new-skill', {});

    // Legacy flat SKILL.md should be gone
    await expect(fs.access(legacyPath)).rejects.toThrow();

    // Legacy skill should now live in its own subdir
    const migratedPath = path.join(localSkillsDir, 'old-skill', 'SKILL.md');
    const migratedContent = await fs.readFile(migratedPath, 'utf8');
    expect(migratedContent).toBe(legacyContent);

    // trackInstall should have been called for the manifest update
    expect(trackInstall).toHaveBeenCalledWith(
      'old-skill',
      expect.objectContaining({ path: migratedPath }),
      false,
    );

    // New skill should be in its own subdir
    const newPath = path.join(localSkillsDir, 'new-skill', 'SKILL.md');
    const newContent = await fs.readFile(newPath, 'utf8');
    expect(newContent).toBe('# new-skill content');
  });

  it('leaves unparseable legacy flat SKILL.md in place and logs a warning', async () => {
    // Flat SKILL.md with no frontmatter at all
    const legacyContent = '# some skill without frontmatter';
    const legacyPath = path.join(localSkillsDir, 'SKILL.md');
    await fs.writeFile(legacyPath, legacyContent, 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const newPkg = { name: 'another-skill', type: 'skill', version: '1.0.0', path: 'registry/another-skill', description: '' };
    const newMeta = { name: 'another-skill', type: 'skill', version: '1.0.0', entry: 'SKILL.md' };
    findAllPackages.mockResolvedValue([{ pkg: newPkg, vault: sampleVault }]);
    downloadFile
      .mockReset()  // clear beforeEach's code-review values
      .mockResolvedValueOnce(JSON.stringify(newMeta))
      .mockResolvedValueOnce('# another-skill content');

    await runInstall('another-skill', {});

    // Legacy flat SKILL.md must still exist, untouched
    const remaining = await fs.readFile(legacyPath, 'utf8');
    expect(remaining).toBe(legacyContent);

    // A warning should have been logged
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('leaving in place'));

    warnSpy.mockRestore();

    // New skill still installs correctly in its own subdir
    const newPath = path.join(localSkillsDir, 'another-skill', 'SKILL.md');
    const newContent = await fs.readFile(newPath, 'utf8');
    expect(newContent).toBe('# another-skill content');
  });

});
