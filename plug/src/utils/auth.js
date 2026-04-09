import { getConfig } from './config.js';

/**
 * Resolves an auth token for the given vault.
 * Resolution order:
 *   1. PLUGVAULT_TOKEN_{VAULT_NAME_UPPER} env var
 *   2. PLUGVAULT_GITHUB_TOKEN env var
 *   3. vault.token from config
 * @param {string} vaultName
 * @returns {string|null}
 */
export async function getAuthForVault(vaultName) {
  // 1. Vault-specific env var
  const envKey = `PLUGVAULT_TOKEN_${vaultName.toUpperCase().replace(/-/g, '_')}`;
  if (process.env[envKey]) return process.env[envKey];

  // 2. Generic GitHub token env var
  if (process.env.PLUGVAULT_GITHUB_TOKEN) return process.env.PLUGVAULT_GITHUB_TOKEN;

  // 3. Config token
  const config = await getConfig();
  const vault = config.vaults?.[vaultName];
  return vault?.token ?? null;
}

/**
 * Returns Authorization headers object for a vault, or empty object if no token.
 * @param {string} vaultName
 * @returns {object}
 */
export async function getAuthHeaders(vaultName) {
  const token = await getAuthForVault(vaultName);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
