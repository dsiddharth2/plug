import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { confirm, select } from '@inquirer/prompts';
import { findPackage, findAllPackages } from '../utils/registry.js';
import { downloadFile } from '../utils/fetcher.js';
import { trackInstall, isInstalled, getInstalled, addDependents } from '../utils/tracker.js';
import { getClaudeSkillsDir, getClaudeAgentsDir, getClaudeDirForType, ensureDir } from '../utils/paths.js';
import { createSpinner } from '../utils/ui.js';
import { ctx, verbose } from '../utils/context.js';
import { pkgVersion } from '../utils/pkg-version.js';
import { resolve } from '../utils/resolver.js';
import { parseFrontmatter } from '../utils/frontmatter.js';

export function registerInstall(program) {
  program
    .command('install <name>')
    .description('Install a skill or command from a vault')
    .option('-g, --global', 'install globally to ~/.claude/')
    .action(async (name, options) => {
      try {
        await runInstall(name, options);
      } catch (err) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ error: err.message }) + '\n');
        } else {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });
}

export async function runInstall(name, options = {}) {
  const isGlobal = options.global || false;

  // Parse vault prefix (vault/name)
  let vaultName = null;
  let pkgName = name;
  if (name.includes('/')) {
    const slashIdx = name.indexOf('/');
    vaultName = name.slice(0, slashIdx);
    pkgName = name.slice(slashIdx + 1);
  }

  // Auto-init if .claude/ directories don't exist
  const skillsDir = getClaudeSkillsDir(isGlobal);
  const agentsDir = getClaudeAgentsDir(isGlobal);
  let skillsDirExists = false;
  try {
    await fs.access(skillsDir);
    skillsDirExists = true;
  } catch {
    skillsDirExists = false;
  }
  if (!skillsDirExists) {
    verbose('Auto-initializing .claude/ directories');
    await ensureDir(skillsDir);
    await ensureDir(getClaudeDirForType('command', isGlobal));
    await ensureDir(agentsDir);
  }

  // Resolve package — with conflict detection if no vault prefix
  const resolveSpinner = createSpinner('Resolving package...');
  let result;
  try {
    if (vaultName) {
      verbose(`Resolving ${pkgName} from vault ${vaultName}`);
      result = await findPackage(pkgName, vaultName);
      resolveSpinner.stop();
      if (!result) {
        throw new Error(`Package '${pkgName}' not found in vault '${vaultName}'.`);
      }
    } else {
      verbose(`Searching all vaults for ${pkgName}`);
      const allMatches = await findAllPackages(pkgName);
      resolveSpinner.stop();
      if (allMatches.length === 0) {
        throw new Error(`Package '${pkgName}' not found in any vault.`);
      }
      if (allMatches.length > 1) {
        verbose(`Found in ${allMatches.length} vaults: ${allMatches.map(m => m.vault.name).join(', ')}`);
        // Conflict — auto-pick first if --yes, else prompt
        if (ctx.yes) {
          result = allMatches[0];
        } else {
          const choice = await select({
            message: `'${pkgName}' found in multiple vaults. Select one:`,
            choices: allMatches.map((m) => ({
              name: `${m.vault.name} — ${m.pkg.description || '(no description)'}`,
              value: m,
            })),
          });
          result = choice;
        }
      } else {
        result = allMatches[0];
      }
    }
  } catch (err) {
    resolveSpinner.stop();
    throw err;
  }

  const { pkg, vault } = result;
  verbose(`Resolved ${pkgName} from vault ${vault.name} (v${pkg.version || '?'})`);

  // Overwrite prompt if already installed
  const alreadyInstalled = await isInstalled(pkgName, isGlobal);
  if (alreadyInstalled) {
    if (ctx.yes) {
      verbose(`--yes: auto-confirming overwrite of ${pkgName}`);
    } else {
      const overwrite = await confirm({
        message: `'${pkgName}' is already installed. Overwrite?`,
        default: false,
      });
      if (!overwrite) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ status: 'aborted', name: pkgName }) + '\n');
        } else {
          console.log(chalk.yellow('Aborted.'));
        }
        return;
      }
    }
  }

  // Resolve dependency plan
  const plan = await resolve(pkgName, vault.name, { global: isGlobal });

  // Show plan summary and prompt when there are deps to install
  if (!ctx.json && plan.toInstall.length > 1) {
    console.log(chalk.cyan(`\nDependency plan for '${pkgName}':`));
    console.log(chalk.white(`  Will install (${plan.toInstall.length}):`));
    for (const n of plan.toInstall) {
      const label = n === pkgName ? '' : chalk.dim(' (dependency)');
      console.log(`    - ${n}${label}`);
    }
    if (plan.alreadySatisfied.length > 0) {
      console.log(chalk.dim(`  Already satisfied: ${plan.alreadySatisfied.join(', ')}`));
    }
    if (!ctx.yes) {
      const proceed = await confirm({ message: 'Proceed? (Y/n)', default: true });
      if (!proceed) {
        if (ctx.json) {
          process.stdout.write(JSON.stringify({ status: 'aborted', name: pkgName }) + '\n');
        } else {
          console.log(chalk.yellow('Aborted.'));
        }
        return;
      }
    }
  }

  // Build ordered install list — always include root even if resolver returned empty
  const installOrder = [...plan.toInstall];
  if (!installOrder.includes(pkgName)) {
    installOrder.push(pkgName);
  }

  // Build pkgSpec map: root is already resolved; deps need lookup
  const pkgSpecMap = new Map();
  pkgSpecMap.set(pkgName, { pkg, vault, rawBaseUrl: pkg.rawBaseUrl ?? null });

  for (const depName of installOrder) {
    if (depName === pkgName || pkgSpecMap.has(depName)) continue;
    try {
      const depMatches = await findAllPackages(depName);
      if (depMatches.length > 0) {
        const { pkg: depPkg, vault: depVault } = depMatches[0];
        pkgSpecMap.set(depName, { pkg: depPkg, vault: depVault, rawBaseUrl: depPkg.rawBaseUrl ?? null });
      }
    } catch {
      // Skip unresolvable deps silently
    }
  }

  // Root's direct dependency names (for tracking)
  const rootDirectDeps = (pkg.dependencies ?? []).map(d => (typeof d === 'string' ? d : d.name));

  // Install each package in dep-first order
  let rootInstallInfo = null;
  for (const entryName of installOrder) {
    const entrySpec = pkgSpecMap.get(entryName);
    if (!entrySpec) {
      verbose(`Skipping '${entryName}' — not found in any vault`);
      continue;
    }

    const isRoot = entryName === pkgName;
    const dlSpinner = createSpinner(`Downloading ${entryName}...`);
    let installInfo;
    try {
      installInfo = await installSinglePackage(entrySpec, isGlobal);
      dlSpinner.stop();
    } catch (err) {
      dlSpinner.stop();
      throw err;
    }

    const { type, destPath, version } = installInfo;
    const directDeps = isRoot
      ? rootDirectDeps
      : (entrySpec.pkg.dependencies ?? []).map(d => (typeof d === 'string' ? d : d.name));

    await trackInstall(
      entryName,
      {
        type,
        vault: entrySpec.vault.name,
        version,
        path: destPath,
        installed_as: isRoot ? 'explicit' : 'dependency',
        dependencies: directDeps,
      },
      isGlobal,
    );

    if (isRoot) rootInstallInfo = { type, destPath, version, hookRequired: installInfo.hookRequired };
  }

  // Record reverse-dependency edges
  for (const depName of installOrder) {
    if (depName === pkgName) continue;
    await addDependents(depName, [pkgName], isGlobal);
  }

  // Output
  const { type, destPath, version, hookRequired } = rootInstallInfo ?? { type: 'command', destPath: '', version: pkgVersion, hookRequired: false };

  if (ctx.json) {
    const out = { status: 'installed', name: pkgName, type, vault: vault.name, version, path: destPath };
    if (hookRequired) out.hookRequired = true;
    process.stdout.write(JSON.stringify(out) + '\n');
  } else {
    console.log(chalk.green(`✓ Installed ${pkgName} (${type}) from ${vault.name}`));
    console.log(chalk.cyan(`  Path: ${destPath}`));
    if (type === 'skill') {
      console.log(chalk.cyan(`  Usage: The skill '${pkgName}' is available in your Claude project`));
    } else if (type === 'agent') {
      console.log(chalk.cyan(`  Usage: The agent '${pkgName}' is available for delegation`));
    } else {
      console.log(chalk.cyan(`  Usage: /${pkgName}`));
    }
    if (hookRequired) {
      console.log(chalk.yellow(`⚠ Hook required: '${pkgName}' expects a hook in settings.json`));
    }
  }
}

/**
 * Downloads and writes a single package to disk. Branches on rawBaseUrl for community packages.
 * Returns { type, destPath, version }.
 */
async function installSinglePackage(pkgSpec, isGlobal) {
  const { pkg, vault, rawBaseUrl } = pkgSpec;
  const pkgName = pkg.name;

  let meta, content;

  if (rawBaseUrl) {
    // Community package: fetch via raw base URL directly
    try {
      const metaUrl = rawBaseUrl.endsWith('/')
        ? `${rawBaseUrl}${pkg.path}/meta.json`
        : `${rawBaseUrl}/${pkg.path}/meta.json`;
      const resp = await fetch(metaUrl);
      if (resp.ok) {
        meta = await resp.json();
      } else {
        // Not a failure if meta.json is missing; we'll fall back to pkg info
        meta = { type: pkg.type, entry: pkg.entry || `${pkgName}.md`, version: pkg.version };
      }
    } catch {
      meta = { type: pkg.type, entry: pkg.entry || `${pkgName}.md`, version: pkg.version };
    }

    // Determine entry file and final URL
    // If pkg.entry is a full path from the root of the repo, use it relative to rawBaseUrl
    // Otherwise, use pkg.path + entryFile
    let entryFile = meta.entry || pkg.entry || `${pkgName}.md`;
    let entryUrl;

    if (rawBaseUrl.endsWith('/')) {
      entryUrl = entryFile.startsWith('/')
        ? `${rawBaseUrl}${entryFile.slice(1)}`
        : `${rawBaseUrl}${pkg.path}/${entryFile}`;
    } else {
      entryUrl = entryFile.startsWith('/')
        ? `${rawBaseUrl}${entryFile}`
        : `${rawBaseUrl}/${pkg.path}/${entryFile}`;
    }

    // Clean up potential double slashes (except the one after https:)
    entryUrl = entryUrl.replace(/([^:]\/)\/+/g, '$1');

    verbose(`Downloading community entry file: ${entryUrl}`);
    const entryResp = await fetch(entryUrl);
    if (!entryResp.ok) throw new Error(`Failed to download ${pkgName}: HTTP ${entryResp.status} at ${entryUrl}`);
    content = await entryResp.text();
  } else {
    // Official vault: use downloadFile helper
    try {
      verbose(`Fetching meta.json from ${vault.name}`);
      const metaContent = await downloadFile(vault, `${pkg.path}/meta.json`);
      meta = JSON.parse(metaContent);
    } catch {
      verbose('meta.json unavailable, falling back to registry data');
      meta = { type: pkg.type, entry: pkg.entry || `${pkgName}.md`, version: pkg.version };
    }
    const entryFile = meta.entry || pkg.entry || `${pkgName}.md`;
    verbose(`Downloading entry file: ${entryFile}`);
    content = await downloadFile(vault, `${pkg.path}/${entryFile}`);
  }

  // Route to correct directory by type
  const type = meta.type || pkg.type || 'command';
  const entryFileName = meta.entry ? path.basename(meta.entry) : (pkg.entry ? path.basename(pkg.entry) : `${pkgName}.md`);
  let destPath;

  if (type === 'skill') {
    await migrateLegacyFlatSkillFile(getClaudeSkillsDir(isGlobal), isGlobal);
    const skillSubdir = path.join(getClaudeSkillsDir(isGlobal), pkgName);
    await ensureDir(skillSubdir);
    destPath = path.join(skillSubdir, 'SKILL.md');
  } else {
    const destDir = getClaudeDirForType(type, isGlobal);
    await ensureDir(destDir);
    destPath = path.join(destDir, entryFile);
  }

  verbose(`Writing to ${destPath}`);
  try {
    await fs.writeFile(destPath, content, 'utf8');
  } catch (err) {
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      throw Object.assign(
        new Error(`Cannot write to ${destPath}. Check permissions.`),
        { code: err.code },
      );
    }
    throw err;
  }

  const fm = type === 'skill' ? parseFrontmatter(content) : {};
  const hookRequired = !!(fm.hook || fm.hooks);

  return { type, destPath, version: meta.version || pkg.version || pkgVersion, hookRequired };
}

/**
 * Migrates a legacy flat .claude/skills/SKILL.md to .claude/skills/<name>/SKILL.md.
 * Parses the frontmatter for `name:` using a regex. If not parseable, logs a warning
 * and leaves the file alone (non-destructive).
 * @param {string} skillsDir - absolute path to .claude/skills/
 * @param {boolean} isGlobal
 */
async function migrateLegacyFlatSkillFile(skillsDir, isGlobal) {
  const legacyPath = path.join(skillsDir, 'SKILL.md');
  let content;
  try {
    content = await fs.readFile(legacyPath, 'utf8');
  } catch {
    return; // no legacy flat file
  }

  // Extract frontmatter block between first pair of --- fences
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/m);
  if (!fmMatch) {
    console.warn('Warning: Found legacy .claude/skills/SKILL.md but no frontmatter found — leaving in place.');
    return;
  }
  const nameMatch = fmMatch[1].match(/^name:\s*(\S+)/m);
  if (!nameMatch) {
    console.warn('Warning: Found legacy .claude/skills/SKILL.md but could not parse "name:" from frontmatter — leaving in place.');
    return;
  }

  const skillName = nameMatch[1];
  const newDir = path.join(skillsDir, skillName);
  const newPath = path.join(newDir, 'SKILL.md');

  try {
    await ensureDir(newDir);
    await fs.rename(legacyPath, newPath);
  } catch (err) {
    console.warn(`Warning: Failed to migrate legacy SKILL.md to ${newPath}: ${err.message}`);
    return;
  }

  // Update manifest: find the record pointing at the old path and update it
  try {
    const data = await getInstalled(isGlobal);
    for (const [recName, record] of Object.entries(data.installed || {})) {
      if (record.path === legacyPath) {
        await trackInstall(recName, { ...record, path: newPath }, isGlobal);
        break;
      }
    }
  } catch {
    // Non-critical: file already moved; manifest update failure is best-effort
  }
}
