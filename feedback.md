# Review: raw-mode TTY fix — commit 01e0f9e

**Verdict: APPROVED**

## Summary

The fix correctly resolves the TUI crash when stdin is piped (e.g. `! plug` from Claude Code) by reopening the controlling terminal as a `tty.ReadStream` and passing it to Ink.

## Checklist

| # | Item | Status |
|---|------|--------|
| 1 | `resolve-stdin.js`: correct fallback order (isTTY → /dev/tty → CONIN$) | PASS |
| 2 | Returns `tty.ReadStream` — compatible with Ink's raw mode | PASS |
| 3 | No fd leaks on error path (openSync failure = no fd allocated) | PASS |
| 4 | Error message matches requirements (clear, actionable, three use cases) | PASS |
| 5 | `index.js`: catches error, writes to stderr, exits(1) | PASS |
| 6 | TTY stream passed via `{ stdin }` only when needed | PASS |
| 7 | CLI path unchanged (no regression) | PASS |
| 8 | 5 unit tests cover all branches (TTY, /dev/tty, CONIN$, both-fail, message content) | PASS |
| 9 | Tests use injected mocks (portable, no filesystem dependency) | PASS |
| 10 | All 209 tests pass (204 existing + 5 new) | PASS |
| 11 | No security issues (no shell injection, no token/path logging) | PASS |

## Findings

No issues found. The change is minimal, correct, and well-tested.

### Notes

- Dependency injection via `{ isTTY, openSync, ReadStream }` parameter makes the function cleanly testable without monkeypatching globals.
- The conditional `options` construction in `index.js:58` avoids passing `{ stdin: process.stdin }` to Ink unnecessarily — correct, since Ink already uses `process.stdin` by default.
- Error message wording matches the requirements document verbatim.
- The `catch { continue }` pattern in the candidate loop is correct — bare catch (no binding) is fine here since we only care whether `openSync` succeeded, not why it failed.
