import { describe, it, expect } from 'vitest';
import {
  GITHUB_RAW_BASE,
  OFFICIAL_VAULT_OWNER,
  OFFICIAL_VAULT_REPO,
  DEFAULT_BRANCH,
  REGISTRY_FILE,
} from '../src/constants.js';

const OFFICIAL_REGISTRY_URL = `${GITHUB_RAW_BASE}/${OFFICIAL_VAULT_OWNER}/${OFFICIAL_VAULT_REPO}/${DEFAULT_BRANCH}/${REGISTRY_FILE}`;

describe('official vault integration', () => {
  it('official vault registry.json is reachable on GitHub', async () => {
    const response = await fetch(OFFICIAL_REGISTRY_URL);
    expect(response.status, `GET ${OFFICIAL_REGISTRY_URL} returned ${response.status}`).toBe(200);
  }, 15_000);

  it('official vault registry.json contains valid packages', async () => {
    const response = await fetch(OFFICIAL_REGISTRY_URL);
    const data = await response.json();

    expect(data).toHaveProperty('packages');
    expect(typeof data.packages).toBe('object');

    const packageNames = Object.keys(data.packages);
    expect(packageNames.length).toBeGreaterThan(0);

    // Every package must have required fields
    for (const [name, pkg] of Object.entries(data.packages)) {
      expect(pkg, `package "${name}" missing type`).toHaveProperty('type');
      expect(pkg, `package "${name}" missing version`).toHaveProperty('version');
      expect(pkg, `package "${name}" missing path`).toHaveProperty('path');
      expect(['skill', 'command'], `package "${name}" has invalid type "${pkg.type}"`).toContain(pkg.type);
    }
  }, 15_000);
});
