# Decisions & Trade-offs

## DFS over topological sort

The resolver uses iterative DFS rather than a two-pass topological sort (Kahn's algorithm). The dependency graphs for Claude Code skills are small and shallow; DFS produces a valid dep-first ordering in a single pass, handles cycle detection inline via an `inStack` set, and requires no auxiliary data structures (in-degree map, queue). Kahn's would add code for no practical gain at this scale.

## `addDependents` merge semantics

`addDependents(name, newDependents, global)` **merges** into the existing `dependents` array (with dedup via `Set`) rather than replacing it.

Replacing would corrupt multi-parent packages. If package X is a dependency of both A and B:
- After installing A: `X.dependents = ['A']`
- Installing B calls `addDependents('X', ['B'])` → must yield `['A', 'B']`, not `['B']`

Overwrite semantics would silently erase A from X's dependents, causing a false orphan detection when A is later removed.

## Hook notice is print-only

The post-install hook notice (`⚠ Hook required: '<name>' expects a hook in settings.json`) is a warning, not an automatic action. `plug` does not modify `settings.json`.

Rationale: hook configuration is settings-file surgery that can break the user's existing hooks or add hooks with wrong event names. Silently mutating `settings.json` without user review was judged higher risk than a missed notice. The user retains full control.

## JSON mode vs CLI mode split for hook notice

In CLI mode, the notice is printed to stdout as a chalk-yellow warning. In JSON mode (`--json`), the output object gains `hookRequired: true` (conditionally — absent when false).

Mixing a human-readable warning string into JSON output would break machine consumers. The boolean field lets callers (CI scripts, wrapper tools) detect and act on the hook requirement without parsing prose.

## Shallow cascade on remove

`--cascade` removes direct dependents one level deep. When a dependent is removed via cascade, it does not further cascade into its own dependents. Deep transitive cascade is deferred to a future sprint.

Rationale: deep cascade is hard to reason about and easy to trigger accidentally. Shallow cascade covers the common case (A depends on X; removing X cascades to A) with a predictable blast radius. Users who need deeper removal can repeat the command.

## Community wins on registry name conflict

In `buildPackageMap()`, community-index entries are loaded after official vault entries and overwrite on name collision. This allows community packages to shadow official ones when both registries contain the same name.

Rationale: community packages are typically more specialised or customised variants; a community author explicitly publishing under the same name is expressing an intentional override.
