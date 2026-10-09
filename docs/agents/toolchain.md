# Toolchain & Environment (Windows / PowerShell)

Version-managed toolchains that are **not** on the bare PATH. Don't go hunting for these every session.

## Node — managed by **fnm**
- `fnm.exe`: `%LOCALAPPDATA%\Microsoft\WinGet\Links\fnm.exe` (already on PATH).
- `FNM_DIR`: `%APPDATA%\fnm`; installed versions live under `…\fnm\node-versions\`.
- Default/active version: **v24.13.1** (`node` resolves into an fnm multishell, not a fixed path).
- Activate in a PowerShell session (the Bash/PowerShell tool does NOT auto-load fnm):
  ```powershell
  fnm env --use-on-cd | Out-String | Invoke-Expression
  ```
  After that, `node`, `npm`, `npx` work. `--use-on-cd` makes fnm honor a repo's `.node-version`/`.nvmrc` on entry. Use `pnpm` for workspace scripts (see the root [`AGENTS.md`](../../AGENTS.md) Command Reference).

