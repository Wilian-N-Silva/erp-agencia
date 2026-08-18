# Patch v6 — npm nativo + dependencias por worktree

Este patch corrige dois problemas observados durante a SEC-004 no Windows PowerShell 5.1:

1. worktrees novas nao possuem `node_modules`, causando erros como:
   `'tsc' nao e reconhecido como um comando interno`.
2. `npm.cmd` pode escrever em stderr e, com `$ErrorActionPreference = "Stop"`,
   o Windows PowerShell 5.1 converte a escrita em `NativeCommandError` antes que
   o wrapper leia o exit code real.

## Alteracoes

### `scripts/codex-common.ps1`

- adiciona `Ensure-NodeDependencies`;
- executa `npm ci --prefer-offline --no-audit --no-fund` automaticamente quando
  `node_modules/.bin/tsc` nao existe;
- executa `db:migrate` por `System.Diagnostics.Process`;
- executa todos os `npm run <gate>` por `Invoke-NativeCaptureProcess`;
- usa `ExitCode`, stdout e stderr reais do processo, sem depender do error stream
  do PowerShell 5.1.

### `scripts/codex-worker.ps1`

- garante dependencias depois de criar/reabrir a worktree;
- garante dependencias novamente antes de cada tentativa de gates.

### Remediation script

Se o arquivo ainda tiver a assertion antiga `f/t`, o aplicador troca para
`false/true`. Essa parte e idempotente e opcional.

## Como aplicar

Extraia o ZIP na raiz do repositorio. Depois:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

.\APPLY-PATCH-v6.ps1
```

O aplicador:

- cria backups `.v6.bak`;
- altera apenas trechos exatos;
- para sem sobrescrever se sua versao divergir do formato esperado;
- roda `git diff --check`;
- roda `codex-selfcheck.ps1`.

## Depois do patch

Nao apague a worktree da SEC-004 e nao rode Codex manualmente.

Execute:

```powershell
.\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

Como a SEC-004 ja possui trabalho na worktree, o worker deve retomá-la. O `test:db`
deve agora chegar ao resultado real dos testes; se os dois testes de RLS ainda
falharem por causa do `DrizzleQueryError.cause`, o fluxo de gate-repair podera
corrigi-los automaticamente.

## Commit sugerido

O patch altera a infraestrutura do orquestrador, nao a task SEC-004. Quando estiver
satisfeito:

```powershell
git add scripts/codex-common.ps1 scripts/codex-worker.ps1 scripts/codex-remediate-integration-review.ps1
git commit -m "fix(codex): run npm safely in PowerShell worktrees"
git push origin feature/codex-integration
```

Se `codex-remediate-integration-review.ps1` nao tiver sido alterado, omita-o do
`git add`.
