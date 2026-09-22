# 11 — Orquestração local do Codex

## Objetivo

Executar as tasks dos PRDs de forma sequencial e auditável, mantendo `development` intacta até uma revisão única.

Fluxo:

```text
development
  └─ feature/codex-integration
       ├─ feature/codex-sec-002 ─┐
       ├─ feature/codex-sec-003 ─┤
       ├─ feature/codex-fin-001 ─┤
       └─ ...                    ├─> merge automático na integração
                                └─> review humano único
```

As branches de task são preservadas. O orquestrador nunca faz merge em `development` ou `main`.

## Arquivos

- `docs/codex/tasks.json`: catálogo machine-readable de tasks/dependências.
- `scripts/codex-common.ps1`: helpers.
- `scripts/codex-worker.ps1`: implementa uma task em worktree isolada.
- `scripts/codex-review.ps1`: review automático read-only da task.
- `scripts/codex-orchestrator.ps1`: cria a integração, seleciona tasks e absorve branches aprovadas.
- `scripts/codex-status.ps1`: mostra `integrated`, `ready`, `blocked`, `manual`.
- `scripts/codex-integration-review.ps1`: review final contra `development`.


## Primeira execução

Pré-requisitos:

```powershell
git status
codex --version
npm --version
```

O repositório precisa estar limpo. Os exemplos abaixo assumem **PowerShell**. Em PowerShell, você pode chamar os arquivos `.ps1` diretamente.

Execute:

```powershell
.\\scripts\\codex-orchestrator.ps1 -Push
```

Na primeira execução o script:

1. atualiza `development` por fast-forward;
2. cria `feature/codex-integration` se necessário;
3. procura branches candidatas de tasks já aplicadas (incluindo `SEC-001`) e as absorve quando encontradas;
4. seleciona a primeira task automatizável com dependências satisfeitas;
5. cria uma worktree e branch própria;
6. chama `codex exec` com sandbox de escrita no workspace;
7. executa gates;
8. faz commit da task;
9. chama um segundo Codex em modo read-only para review;
10. se bloqueado, permite até duas tentativas automáticas de correção;
11. mergeia a branch da task em `feature/codex-integration`;
12. executa os gates de integração; se falharem, restaura a candidata ao SHA exato
    anterior ao merge, removendo o marcador de integração da task;
13. continua para a próxima task.

Qualquer falha interrompe a cadeia por padrão. Isso evita que uma task quebrada desbloqueie dependentes.

## Limitar a sessão

Uma task:

```powershell
.\\scripts\\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

Cinco tasks:

```powershell
.\\scripts\\codex-orchestrator.ps1 -MaxTasks 5 -Push
```

Sem push remoto:

```powershell
.\\scripts\\codex-orchestrator.ps1 -MaxTasks 3
```

Modelo explícito, se desejado e suportado pela sua instalação do Codex:

```powershell
.\\scripts\\codex-orchestrator.ps1 -Model "<modelo>" -MaxTasks 3
```

Sem review automático por task:

```powershell
.\\scripts\\codex-orchestrator.ps1 -SkipAutomatedReview -MaxTasks 3
```

Não use `-SkipAutomatedReview` para segurança, acesso, financeiro ou migrations salvo para diagnóstico.

## Ver status

```powershell
.\\scripts\\codex-status.ps1
```

Estados exibidos:

- `integrated`: branch da task já está contida na integração;
- `ready`: dependências satisfeitas;
- `blocked`: depende de outra task;
- `manual`: exige ação humana/infra e não será executada automaticamente.

## Review único

Depois do lote:

```powershell
.\\scripts\\codex-integration-review.ps1
```

Depois rode manualmente:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Se aprovado, o merge `feature/codex-integration -> development` é uma decisão humana e não faz parte do orquestrador.

## Se o review único for ruim

As branches individuais continuam existindo. Use:

```powershell
git log --graph --decorate --oneline --all
```

Cada merge na integração usa mensagem:

```text
merge(codex): integrate <TASK-ID>
```

Então é possível auditar/revisar cada task separadamente sem perder o histórico.

## Worktrees

As worktrees ficam como diretório irmão do repositório:

```text
../erp-agencia-codex-worktrees/<task-id>/
```

Após integração com sucesso, a worktree é removida, mas a branch da task permanece.
Em falha, a worktree é preservada para diagnóstico.

## Tasks manuais

O catálogo marca tarefas de operação/infra como não automatizáveis, por exemplo drills de backup, staging e release final. O orquestrador para antes de executar ações que dependam de credenciais/infra externas.
