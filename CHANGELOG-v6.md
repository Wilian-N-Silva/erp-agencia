# CHANGELOG v6

- Fix Windows PowerShell 5.1 `NativeCommandError` from npm stderr.
- Run npm gates through `System.Diagnostics.Process`.
- Run `db:migrate` through the same native-process abstraction.
- Automatically run `npm ci --prefer-offline --no-audit --no-fund` in worktrees missing dependencies.
- Recheck dependencies before every gate attempt.
- Optionally fix the old remediation role assertion (`f/t` -> `false/true`).
