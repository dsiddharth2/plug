import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import {
  PLUGVAULT_DIR,
  CLAUDE_DIR,
  SKILLS_DIR,
  COMMANDS_DIR,
  AGENTS_DIR,
  INSTALLED_FILE,
  CONFIG_FILE,
  CACHE_DIR,
} from '../constants.js';

/**
 * Returns the global ~/.plugvault directory path.
 */
export function getGlobalDir() {
  return path.join(os.homedir(), PLUGVAULT_DIR);
}

/**
 * Returns the .claude/skills/ path.
 * @param {boolean} global - If true, returns the path under home dir.
 */
export function getClaudeSkillsDir(global = false) {
  const base = global ? os.homedir() : process.cwd();
  return path.join(base, CLAUDE_DIR, SKILLS_DIR);
}

/**
 * Returns the .claude/commands/ path.
 * @param {boolean} global - If true, returns the path under home dir.
 */
export function getClaudeCommandsDir(global = false) {
  const base = global ? os.homedir() : process.cwd();
  return path.join(base, CLAUDE_DIR, COMMANDS_DIR);
}

/**
 * Returns the .claude/agents/ path.
 * @param {boolean} global - If true, returns the path under home dir.
 */
export function getClaudeAgentsDir(global = false) {
  const base = global ? os.homedir() : process.cwd();
  return path.join(base, CLAUDE_DIR, AGENTS_DIR);
}

/**
 * Returns the correct .claude/ subdirectory for a given package type.
 * @param {string} type - Package type: 'skill', 'agent', or default (commands).
 * @param {boolean} global - If true, returns the path under home dir.
 */
export function getClaudeDirForType(type, global = false) {
  if (type === 'skill') return getClaudeSkillsDir(global);
  if (type === 'agent') return getClaudeAgentsDir(global);
  return getClaudeCommandsDir(global);
}

/**
 * Returns the path to installed.json.
 * @param {boolean} global - If true, returns path under ~/.plugvault/
 */
export function getInstalledFilePath(global = false) {
  const base = global ? getGlobalDir() : path.join(process.cwd(), PLUGVAULT_DIR);
  return path.join(base, INSTALLED_FILE);
}

/**
 * Returns the path to config.json (always global).
 */
export function getConfigFilePath() {
  return path.join(getGlobalDir(), CONFIG_FILE);
}

/**
 * Returns the cache directory path.
 */
export function getCacheDir() {
  return path.join(getGlobalDir(), CACHE_DIR);
}

/**
 * Creates a directory (and all parents) if it doesn't already exist.
 * @param {string} dirPath
 */
export async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}
