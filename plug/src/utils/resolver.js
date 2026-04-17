import { fetchRegistry, getStaleRegistryCache } from './registry.js';
import { fetchCommunityIndex, getStaleCommunityIndexCache } from './community-index.js';
import { getInstalled } from './tracker.js';
import { getResolveOrder } from './config.js';

async function buildPackageMap() {
  const packageMap = new Map();

  // Load official vault registries
  try {
    const vaults = await getResolveOrder();
    for (const vault of vaults) {
      let registry = null;
      try {
        registry = await fetchRegistry(vault);
      } catch {
        try { registry = await getStaleRegistryCache(vault.name); } catch { /* offline */ }
      }
      if (!registry) continue;
      const packages = registry.packages || {};
      for (const [name, pkgData] of Object.entries(packages)) {
        packageMap.set(name, { name, ...pkgData, _vault: vault });
      }
    }
  } catch { /* offline — continue with community */ }

  // Load community index — community wins on name conflict
  try {
    let communityData = null;
    try {
      communityData = await fetchCommunityIndex();
    } catch {
      try { communityData = await getStaleCommunityIndexCache(); } catch { /* offline */ }
    }
    if (communityData) {
      const packages = communityData.packages || communityData;
      const pkgList = Array.isArray(packages) ? packages : Object.values(packages);
      for (const pkg of pkgList) {
        if (pkg.name) {
          packageMap.set(pkg.name, { ...pkg, dependencies: pkg.dependencies ?? [] });
        }
      }
    }
  } catch { /* offline */ }

  return packageMap;
}

function dfsResolve(name, packageMap, installedSnapshot, toInstall, alreadySatisfied, cycles, visited, inStack) {
  if (inStack.has(name)) {
    cycles.push(name);
    return;
  }
  if (visited.has(name)) return;

  inStack.add(name);

  const pkg = packageMap.get(name);
  const deps = pkg?.dependencies ?? [];

  for (const dep of deps) {
    const depName = typeof dep === 'string' ? dep : dep.name;
    const required = typeof dep === 'string' ? true : (dep.required !== false);
    if (!required) continue;
    if (!packageMap.has(depName)) continue; // unknown dep — silently skip
    dfsResolve(depName, packageMap, installedSnapshot, toInstall, alreadySatisfied, cycles, visited, inStack);
  }

  inStack.delete(name);
  visited.add(name);

  const isAlreadyInstalled = Object.prototype.hasOwnProperty.call(installedSnapshot.installed, name);
  if (isAlreadyInstalled) {
    if (!alreadySatisfied.includes(name)) alreadySatisfied.push(name);
  } else {
    if (!toInstall.includes(name)) toInstall.push(name);
  }
}

export async function resolve(pkgName, vaultHint = null, options = {}) {
  const isGlobal = options.global ?? false;

  const [packageMap, installedSnapshot] = await Promise.all([
    buildPackageMap(),
    getInstalled(isGlobal),
  ]);

  const toInstall = [];
  const alreadySatisfied = [];
  const cycles = [];
  const visited = new Set();
  const inStack = new Set();

  dfsResolve(pkgName, packageMap, installedSnapshot, toInstall, alreadySatisfied, cycles, visited, inStack);

  return { toInstall, alreadySatisfied, cycles };
}
