import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import {
  getGlobalDir,
  getClaudeSkillsDir,
  getClaudeCommandsDir,
  getInstalledFilePath,
  getConfigFilePath,
  getCacheDir,
  ensureDir,
} from '../src/utils/paths.js';

describe('paths utils', () => {
  it('getGlobalDir returns ~/.plugvault', () => {
    expect(getGlobalDir()).toBe(path.join(os.homedir(), '.plugvault'));
  });

  it('getClaudeSkillsDir local returns cwd/.claude/skills', () => {
    expect(getClaudeSkillsDir(false)).toBe(path.join(process.cwd(), '.claude', 'skills'));
  });

  it('getClaudeSkillsDir global returns home/.claude/skills', () => {
    expect(getClaudeSkillsDir(true)).toBe(path.join(os.homedir(), '.claude', 'skills'));
  });

  it('getClaudeCommandsDir local returns cwd/.claude/commands', () => {
    expect(getClaudeCommandsDir(false)).toBe(path.join(process.cwd(), '.claude', 'commands'));
  });

  it('getClaudeCommandsDir global returns home/.claude/commands', () => {
    expect(getClaudeCommandsDir(true)).toBe(path.join(os.homedir(), '.claude', 'commands'));
  });

  it('getInstalledFilePath local returns cwd/.plugvault/installed.json', () => {
    expect(getInstalledFilePath(false)).toBe(path.join(process.cwd(), '.plugvault', 'installed.json'));
  });

  it('getInstalledFilePath global returns ~/.plugvault/installed.json', () => {
    expect(getInstalledFilePath(true)).toBe(path.join(os.homedir(), '.plugvault', 'installed.json'));
  });

  it('getConfigFilePath returns ~/.plugvault/config.json', () => {
    expect(getConfigFilePath()).toBe(path.join(os.homedir(), '.plugvault', 'config.json'));
  });

  it('getCacheDir returns ~/.plugvault/cache', () => {
    expect(getCacheDir()).toBe(path.join(os.homedir(), '.plugvault', 'cache'));
  });

  describe('ensureDir', () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = path.join(os.tmpdir(), `plugvault-test-${Date.now()}`);
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('creates nested directories', async () => {
      const nested = path.join(tmpDir, 'a', 'b', 'c');
      await ensureDir(nested);
      const stat = await fs.stat(nested);
      expect(stat.isDirectory()).toBe(true);
    });

    it('does not throw if directory already exists', async () => {
      await ensureDir(tmpDir);
      await expect(ensureDir(tmpDir)).resolves.not.toThrow();
    });
  });
});
