# Paste Support in TUI Inputs

## How it works

plug uses **bracketed paste mode** to allow users to paste text into TUI text fields. When bracketed paste mode is active, the terminal wraps any pasted text between `ESC[200~` (start) and `ESC[201~` (end) markers. This lets plug distinguish a paste event from individual keystrokes.

Without bracketed paste, a multi-character paste arrives as a burst of individual key events. Ink processes them sequentially but has no way to know they are a single paste — some characters may be dropped, mis-interpreted as control sequences, or trigger action shortcuts (`i`, `r`, `u`).

## ANSI sequences

| Sequence | Purpose |
|---|---|
| `\x1b[?2004h` | Enable bracketed paste mode |
| `\x1b[?2004l` | Disable bracketed paste mode |
| `\x1b[200~` | Paste start marker (sent by terminal before pasted text) |
| `\x1b[201~` | Paste end marker (sent by terminal after pasted text) |

## Lifecycle in `launchTui()`

Bracketed paste mode is enabled and disabled inside `launchTui()` in `src/index.js`, layered on top of the alt-screen buffer:

```
Enter order:
  \x1b[?1049h   (alt-screen enter)
  \x1b[?2004h   (bracketed paste enable)

Leave order (reverse):
  \x1b[?2004l   (bracketed paste disable)
  \x1b[?1049l   (alt-screen leave)
```

The reversed teardown order ensures the terminal is always left in a clean state. `cleanup()` is called from both `process.on('exit')` and `waitUntilExit().then()` so cleanup runs regardless of how the process exits.

## The `usePaste` hook

`src/tui/hooks/use-paste.js` exports a single React hook:

```js
usePaste(onPaste, { isActive = true } = {})
```

- Listens on `process.stdin` for `data` events.
- Accumulates bytes across chunk boundaries until the `ESC[201~` end marker is found.
- Calls `onPaste(text)` with the complete pasted string (markers stripped).
- Handles multiple paste sequences arriving in the same chunk.
- Suspends (removes the listener) when `isActive` is `false`.
- Removes the listener on component unmount via the React effect cleanup return.

## Which components use `usePaste`

| Component | File | `isActive` condition |
|---|---|---|
| `SearchBox` | `src/tui/components/search-box.jsx` | `focused` (only when search box is open) |
| `AddVaultForm` | `src/tui/screens/vaults.jsx` | Always active while the form is mounted |

All other `useInput` sites in the TUI handle navigation or single-key action keys — they do not accept free-form text input and do not use `usePaste`.

## Terminal compatibility

| Terminal | Bracketed paste support |
|---|---|
| Windows Terminal | Yes |
| PowerShell 7+ | Yes (when hosted in Windows Terminal) |
| Git Bash (mintty) | Yes |
| Legacy `cmd.exe` | No |
| ConEmu (older) | Partial — depends on version |
| Most modern Linux/macOS terminals | Yes |

Terminals that do not support bracketed paste will not send the start/end markers. In that case `usePaste` never fires; the user can still type characters one at a time via `useInput`. There is no error or visible degradation — paste simply does not work as a single-event operation.
