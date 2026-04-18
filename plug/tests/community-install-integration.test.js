/**
 * Integration test: fetches the real community index, then installs every
 * package through the same installSinglePackage flow the TUI uses.
 *
 * Run:
 *   npx vitest run tests/community-install-integration.test.js
 *
 * Limit to N packages (fastest smoke test):
 *   LIMIT=5 npx vitest run tests/community-install-integration.test.js
 *
 * Filter by name substring:
 *   FILTER=test-driven npx vitest run tests/community-install-integration.test.js
 *
 * Output dir (default: ./test-output/community-install):
 *   OUTPUT_DIR=/tmp/plug-check npx vitest run tests/community-install-integration.test.js
 *
 * Use a local community-index.json instead of GitHub:
 *   LOCAL_INDEX=/path/to/community-index.json npx vitest run tests/community-install-integration.test.js
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { installSinglePackage } from '../src/commands/install.js';
import { fetchCommunityIndex, normalizeCommunityPackage } from '../src/utils/community-index.js';
import { ctx } from '../src/utils/context.js';

const LOCAL_INDEX = process.env.LOCAL_INDEX || '';

const OUTPUT_DIR = process.env.OUTPUT_DIR
  || path.resolve(import.meta.dirname, '..', 'test-output', 'community-install');
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const FILTER = process.env.FILTER || '';

const reportPath = path.join(OUTPUT_DIR, '_report.json');
const report = { total: 0, passed: 0, failed: 0, skipped: 0, packages: [] };

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

// Override paths so everything writes into OUTPUT_DIR
const claudeDir = path.join(OUTPUT_DIR, '.claude');
const skillsDir = path.join(claudeDir, 'skills');
const commandsDir = path.join(claudeDir, 'commands');
const agentsDir = path.join(claudeDir, 'agents');

// We need to mock paths and tracker so installSinglePackage writes to our output dir.
// But we want REAL network calls — no mocking fetch.
import { vi } from 'vitest';

vi.mock('../src/utils/paths.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getClaudeSkillsDir: () => skillsDir,
    getClaudeCommandsDir: () => commandsDir,
    getClaudeAgentsDir: () => agentsDir,
    getClaudeDirForType: (type) => {
      if (type === 'skill') return skillsDir;
      if (type === 'agent') return agentsDir;
      return commandsDir;
    },
    getInstalledFilePath: () => path.join(OUTPUT_DIR, '.plugvault', 'installed.json'),
    getGlobalDir: () => OUTPUT_DIR,
    getConfigFilePath: () => path.join(OUTPUT_DIR, '.plugvault', 'config.json'),
    getCacheDir: () => path.join(OUTPUT_DIR, '.plugvault', 'cache'),
    ensureDir: actual.ensureDir,
  };
});

vi.mock('../src/utils/tracker.js', () => ({
  trackInstall: async () => {},
  isInstalled: async () => false,
  getInstalled: async () => ({ installed: {} }),
  addDependents: async () => {},
}));

vi.mock('../src/utils/resolver.js', () => ({
  resolve: vi.fn().mockResolvedValue({ toInstall: [], alreadySatisfied: [], cycles: [] }),
}));

let communityPackages = [];

describe('community install integration', () => {
  beforeAll(async () => {
    ctx.set({ yes: true, verbose: false, json: false });

    await ensureDir(skillsDir);
    await ensureDir(commandsDir);
    await ensureDir(agentsDir);
    await ensureDir(path.join(OUTPUT_DIR, '.plugvault', 'cache'));

    // Fetch community index — local file or remote
    let index;
    if (LOCAL_INDEX) {
      const raw = await fs.readFile(LOCAL_INDEX, 'utf8');
      index = JSON.parse(raw);
    } else {
      index = await fetchCommunityIndex();
    }
    const rawPkgs = index.packages || [];

    communityPackages = rawPkgs
      .filter((p) => !FILTER || p.name.includes(FILTER))
      .slice(0, LIMIT)
      .map((p) => normalizeCommunityPackage(p));

    report.total = communityPackages.length;
    console.log(`\n  Community index: ${rawPkgs.length} total, testing ${communityPackages.length} packages`);
    console.log(`  Output: ${OUTPUT_DIR}\n`);
  }, 30_000);

  afterAll(async () => {
    await ensureDir(OUTPUT_DIR);
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n  ══════════════════════════════════════════`);
    console.log(`  Report: ${reportPath}`);
    console.log(`  Total: ${report.total}  Passed: ${report.passed}  Failed: ${report.failed}  Skipped: ${report.skipped}`);
    console.log(`  Output dir: ${OUTPUT_DIR}`);
    console.log(`  ══════════════════════════════════════════\n`);
  });

  it('installs all community packages', async () => {
    for (const pkg of communityPackages) {
      const pkgSpec = {
        pkg,
        vault: { name: pkg.vault, url: pkg.vaultUrl },
        rawBaseUrl: pkg.rawBaseUrl ?? null,
      };

      const entry = {
        name: pkg.name,
        type: pkg.type,
        vault: pkg.vault,
        fileCount: (pkg.files || []).length,
        status: 'pending',
        files: [],
        error: null,
      };

      try {
        const result = await installSinglePackage(pkgSpec, false);
        entry.status = 'passed';
        entry.files = result.files || [];
        entry.destPath = result.destPath;
        entry.version = result.version;
        report.passed++;
      } catch (err) {
        entry.status = 'failed';
        entry.error = err.message;
        report.failed++;
      }

      report.packages.push(entry);

      // Progress indicator
      const done = report.passed + report.failed + report.skipped;
      const symbol = entry.status === 'passed' ? '✓' : '✗';
      const extra = entry.files.length > 1 ? ` (${entry.files.length} files)` : '';
      console.log(`    ${symbol} [${done}/${report.total}] ${pkg.name}${extra}${entry.error ? ' — ' + entry.error : ''}`);
    }

    // Write final report
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

    // Assertions
    expect(report.failed).toBe(0);
    expect(report.passed).toBe(report.total);
  }, 600_000); // 10 min timeout for all downloads
});
