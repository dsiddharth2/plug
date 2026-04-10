import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

// ---------------------------------------------------------------------------
// Temp directories for isolation
// ---------------------------------------------------------------------------

const tmpDir = path.join(os.tmpdir(), `plugvault-update-test-${Date.now()}`);
const configPath = path.join(tmpDir, 'config.json');
const cacheDir = path.join(tmpDir, 'cache');
const installedPath = path.join(tmpDir, 'installed.json');
const claudeDir = path.join(tmpDir, '.claude');
const commandsDir = path.join(claudeDir, 'commands');
const skillsDir = path.join(claudeDir, 'skills');

const agentsDir = path.join(claudeDir, 'agents');

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalDir: () => tmpDir,
    getConfigFilePath: () => configPath,
    getCacheDir: () => cacheDir,
    getInstalledFilePath: () => installedPath,
    getClaudeCommandsDir: () => commandsDir,
    getClaudeSkillsDir: () => skillsDir,
    getClaudeAgentsDir: () => agentsDir,
    getClaudeDirForType: (type) => {
      if (type === 'skill') return skillsDir;
      if (type === 'agent') return agentsDir;
      return commandsDir;
    },
    ensureDir: actual.ensureDir,
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

const { runUpdate, runUpdateAll, compareSemver } = await import('../src/commands/update.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const officialVault = {
  name: 'official',
  owner: 'dsiddharth2',
  repo: 'plugvault',
  branch: 'main',
  private: false,
};

function makeRegistry(version = '1.2.0') {
  return {
    packages: {
      'code-review': {
        type: 'command',
        version,
        path: 'registry/code-review',
        description: 'Code review',
        tags: ['review'],
      },
    },
  };
}

async function writeConfig(config) {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

async function writeInstalled(data) {
  await fs.mkdir(path.dirname(installedPath), { recursive: true });
  await fs.writeFile(installedPath, JSON.stringify(data, null, 2), 'utf8');
}

async function readInstalled() {
  const raw = await fs.readFile(installedPath, 'utf8');
  return JSON.parse(raw);
}

function mockFetchRegistry(registryData, metaData, fileContent = '# updated content') {
  global.fetch = vi.fn().mockImplementation((url) => {
    if (url.includes('registry.json')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => registryData });
    }
    if (url.includes('meta.json')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(metaData || { type: 'command', entry: 'code-review.md', version: registryData.packages['code-review'].version }),
      });
    }
    // Entry file
    return Promise.resolve({ ok: true, status: 200, text: async () => fileContent });
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.mkdir(commandsDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(agentsDir, { recursive: true });
  await writeConfig({
    vaults: { official: officialVault },
    resolve_order: ['official'],
    default_vault: 'official',
  });
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  delete global.fetch;
});

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------

describe('compareSemver', () => {
  it('returns 1 when a is newer', () => {
    expect(compareSemver('1.2.0', '1.0.0')).toBe(1);
    expect(compareSemver('2.0.0', '1.9.9')).toBe(1);
    expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
  });

  it('returns 0 when equal', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('2.3.4', '2.3.4')).toBe(0);
  });

  it('returns -1 when a is older', () => {
    expect(compareSemver('1.0.0', '1.2.0')).toBe(-1);
    expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
  });

  it('handles missing patch segment', () => {
    expect(compareSemver('1.1', '1.0')).toBe(1);
    expect(compareSemver('1.0', '1.0')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// runUpdate — single package
// ---------------------------------------------------------------------------

describe('runUpdate', () => {
  it('updates package when newer version available', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(makeRegistry('1.2.0'), {
      type: 'command',
      entry: 'code-review.md',
      version: '1.2.0',
    });

    const result = await runUpdate('code-review');
    expect(result.status).toBe('updated');
    expect(result.from).toBe('1.0.0');
    expect(result.to).toBe('1.2.0');
  });

  it('updates installed.json with new version', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(makeRegistry('1.2.0'), {
      type: 'command',
      entry: 'code-review.md',
      version: '1.2.0',
    });

    await runUpdate('code-review');
    const installed = await readInstalled();
    expect(installed.installed['code-review'].version).toBe('1.2.0');
  });

  it('returns up-to-date when version unchanged', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(makeRegistry('1.0.0'), null);

    const result = await runUpdate('code-review');
    expect(result.status).toBe('up-to-date');
  });

  it('returns up-to-date when installed version is newer than registry', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '2.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(makeRegistry('1.0.0'), null);

    const result = await runUpdate('code-review');
    expect(result.status).toBe('up-to-date');
  });

  it('returns not-installed for unknown package', async () => {
    await writeInstalled({ installed: {} });
    mockFetchRegistry(makeRegistry('1.0.0'), null);

    const result = await runUpdate('nonexistent');
    expect(result.status).toBe('not-installed');
  });

  it('returns vault-unavailable when vault fetch fails', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    global.fetch = vi.fn().mockRejectedValue(new Error('ENOTFOUND'));

    const result = await runUpdate('code-review');
    expect(result.status).toBe('vault-unavailable');
  });

  it('writes updated file content to disk', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(
      makeRegistry('1.1.0'),
      { type: 'command', entry: 'code-review.md', version: '1.1.0' },
      '# updated code review v1.1.0'
    );

    await runUpdate('code-review');
    const fileContent = await fs.readFile(path.join(commandsDir, 'code-review.md'), 'utf8');
    expect(fileContent).toBe('# updated code review v1.1.0');
  });

});

// ---------------------------------------------------------------------------
// runUpdateAll
// ---------------------------------------------------------------------------

describe('runUpdateAll', () => {
  it('returns summary with zero updated when nothing installed', async () => {
    await writeInstalled({ installed: {} });
    global.fetch = vi.fn();

    const result = await runUpdateAll();
    expect(result.updated).toBe(0);
    expect(result.upToDate).toBe(0);
  });

  it('updates all packages with newer versions', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(
      makeRegistry('1.2.0'),
      { type: 'command', entry: 'code-review.md', version: '1.2.0' }
    );

    const result = await runUpdateAll();
    expect(result.updated).toBe(1);
    expect(result.upToDate).toBe(0);
  });

  it('counts up-to-date packages correctly', async () => {
    await writeInstalled({
      installed: {
        'code-review': {
          type: 'command',
          vault: 'official',
          version: '1.0.0',
          path: path.join(commandsDir, 'code-review.md'),
        },
      },
    });

    mockFetchRegistry(makeRegistry('1.0.0'), null);

    const result = await runUpdateAll();
    expect(result.updated).toBe(0);
    expect(result.upToDate).toBe(1);
  });
});
