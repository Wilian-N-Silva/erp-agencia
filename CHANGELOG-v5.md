# Changelog v5

## Correcao principal

- Corrige `NativeCommandError` no Windows PowerShell 5.1 quando `codex.exe` escreve informacoes em stderr.
- Remove `& codex ... 2>&1 | Out-Host` da execucao principal.
- Executa `codex.exe` via `System.Diagnostics.Process`, herdando o console para manter a saida ao vivo.
- Exit code agora vem diretamente de `Process.ExitCode`.
- `codex --help` e `codex exec --help` usam captura separada de stdout/stderr, sem passar pelo error stream do PowerShell.
- Adiciona quoting de argumentos compativel com Windows para prompts multiline/aspas.

## Recuperacao

Se a SEC-003 falhou imediatamente apenas no banner do Codex e a worktree ficou limpa, nao ha implementacao para recuperar. Apos aplicar este patch, rode novamente o orquestrador com `-MaxTasks 1`.
