import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const tmpDir = path.join(os.tmpdir(), `plugvault-init-test-${Date.now()}`);
const localPlugvaultDir = path.join(tmpDir, '.plugvault');
const localSkillsDir = path.join(tmpDir, '.claude', 'skills');
const localCommandsDir = path.join(tmpDir, '.claude', 'commands');
const localInstalledFile = path.join(tmpDir, '.plugvault', 'installed.json');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeSkillsDir: (global = false) => {
      if (global) return path.join(os.homedir(), '.claude', 'skills');
      return localSkillsDir;
    },
    getClaudeCommandsDir: (global = false) => {
      if (global) return path.join(os.homedir(), '.claude', 'commands');
      return localCommandsDir;
    },
    getInstalledFilePath: (global = false) => {
      if (global) return path.join(os.homedir(), '.plugvault', 'installed.json');
      return localInstalledFile;
    },
    ensureDir: actual.ensureDir,
  };
});

const { runInit } = await import('../src/commands/init.js');

describe('plug init', () => {
  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates .claude/skills/, .claude/commands/, and .plugvault/installed.json', async () => {
    await runInit();

    const skillsStat = await fs.stat(localSkillsDir);
    expect(skillsStat.isDirectory()).toBe(true);

    const commandsStat = await fs.stat(localCommandsDir);
    expect(commandsStat.isDirectory()).toBe(true);

    const installedStat = await fs.stat(localInstalledFile);
    expect(installedStat.isFile()).toBe(true);

    const installedContent = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(installedContent).toEqual({ installed: {} });
  });

  it('skips existing directories gracefully', async () => {
    // Pre-create dirs and file
    await fs.mkdir(localSkillsDir, { recursive: true });
    await fs.mkdir(localCommandsDir, { recursive: true });
    await fs.mkdir(localPlugvaultDir, { recursive: true });
    await fs.writeFile(localInstalledFile, JSON.stringify({ installed: { 'pre-existing': {} } }), 'utf8');

    await runInit();

    // Existing installed.json should not be overwritten
    const content = JSON.parse(await fs.readFile(localInstalledFile, 'utf8'));
    expect(content.installed['pre-existing']).toBeDefined();
  });

  it('only creates missing directories when some already exist', async () => {
    // Pre-create only skills dir
    await fs.mkdir(localSkillsDir, { recursive: true });

    await runInit();

    // commands dir should be created
    const commandsStat = await fs.stat(localCommandsDir);
    expect(commandsStat.isDirectory()).toBe(true);

    // installed.json should be created
    const installedStat = await fs.stat(localInstalledFile);
    expect(installedStat.isFile()).toBe(true);
  });
});
