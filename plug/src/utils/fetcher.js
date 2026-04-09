import { getAuthHeaders } from './auth.js';
import { GITHUB_RAW_BASE, DEFAULT_BRANCH } from '../constants.js';

/**
 * Downloads a file from a vault's GitHub repo.
 * @param {object} vault - { name, owner, repo, branch }
 * @param {string} filePath - Path within the repo (e.g., "registry/code-review/code-review.md")
 * @returns {string} File contents as a string
 */
export async function downloadFile(vault, filePath) {
  const branch = vault.branch || DEFAULT_BRANCH;
  const url = `${GITHUB_RAW_BASE}/${vault.owner}/${vault.repo}/${branch}/${filePath}`;
  const headers = await getAuthHeaders(vault.name);

  let response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    if (err.cause?.code === 'ENOTFOUND' || err.cause?.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw Object.assign(
        new Error('Connection failed. Check your internet connection.'),
        { code: 'NETWORK_ERROR' }
      );
    }
    throw err;
  }

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(
      new Error(`Authentication failed for vault '${vault.name}'. Run: plug vault set-token ${vault.name} <token>`),
      { code: 'AUTH_FAILED', status: response.status }
    );
  }
  if (response.status === 404) {
    throw Object.assign(
      new Error(`File not found: ${filePath} in vault '${vault.name}'.`),
      { code: 'NOT_FOUND', status: 404 }
    );
  }
  if (!response.ok) {
    throw new Error(`Failed to download ${filePath}: HTTP ${response.status}`);
  }

  return response.text();
}
