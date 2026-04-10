// PlugVault CLI — constants

export const PLUGVAULT_DIR = '.plugvault';
export const CLAUDE_DIR = '.claude';
export const SKILLS_DIR = 'skills';
export const COMMANDS_DIR = 'commands';
export const CONFIG_FILE = 'config.json';
export const INSTALLED_FILE = 'installed.json';
export const CACHE_DIR = 'cache';

export const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const OFFICIAL_VAULT_NAME = 'official';
export const OFFICIAL_VAULT_OWNER = 'dsiddharth2';
export const OFFICIAL_VAULT_REPO = 'plugvault';

export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
export const GITHUB_API_BASE = 'https://api.github.com';

// Template: https://raw.githubusercontent.com/{owner}/{repo}/{branch}/registry.json
export const REGISTRY_FILE = 'registry.json';
export const DEFAULT_BRANCH = 'main';

export const OFFICIAL_VAULT = {
  name: OFFICIAL_VAULT_NAME,
  owner: OFFICIAL_VAULT_OWNER,
  repo: OFFICIAL_VAULT_REPO,
  branch: DEFAULT_BRANCH,
  private: false,
};
