# Package Data Flow

## Sources

Packages in the Discover tab come from two independent sources:

| Source     | File fetched              | Per-request or global | Auth required |
|------------|---------------------------|------------------------|---------------|
| Official   | `registry.json` per vault | One fetch per vault    | Yes (vault token) |
| Community  | `community-index.json`    | One fetch total        | No (public URL) |

Official vault packages are fetched inside a loop over configured vaults. Community packages are fetched once after that loop completes.

## Normalization

Both sources are normalized to the same internal package shape before being merged:

- Official packages are mapped by the registry fetch logic in `src/utils/registry.js`.
- Community packages are mapped by `normalizeCommunityPackage()` in `src/utils/community-index.js`.

The key distinguishing field after normalization is `source`:
- Community packages: `source: 'community'`
- Official packages: no `source` field (or implicitly official)

All other display fields (`name`, `vault`, `version`, `description`, `tags`, `path`, `depCount`) are present on both shapes after normalization, so the same rendering components handle both without branching.

## Cache Pattern

Both sources use the same cache strategy:

1. **Cache directory:** `getCacheDir()` — a per-user local directory for plug state.
2. **TTL:** `CACHE_TTL_MS` — defined in constants; same value for both sources.
3. **Cache files:**
   - Official: one file per vault (named by vault ID).
   - Community: `community-index.json` (single file).
4. **Cache hit:** if the cached file exists and its mtime is within `CACHE_TTL_MS`, return it directly without a network call.
5. **Stale fallback:** if the network call fails, `getStaleCommunityIndexCache()` (and the equivalent registry utility) returns the cached file regardless of age. This allows the TUI to function offline as long as any cache exists.
6. **No cache + failure:** the source is absent from the merged list. Official absence triggers the "all vaults failed" error screen; community absence is silent.

## Merge and Sort

After both fetch paths complete (with failures isolated in separate `try/catch` blocks), the `all` array contains packages from all sources. A single alphabetical sort at the end of `load()` in `use-packages.js` orders the merged list.

## Failure Isolation

The community fetch has its own `try/catch` that does **not** touch `networkFailCount`. This ensures:
- Community failure never triggers the "all vaults failed" error screen.
- Official and community failure modes are independent.

Only official vault fetch failures increment `networkFailCount`. If all official vaults fail, the error screen appears regardless of community fetch outcome.
