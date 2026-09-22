# 10 — Operação do Codex por sessão e à noite

## 1. Objetivo

Dar um ritual simples para usar Codex sem precisar reescrever o contexto em cada conversa.

O arquivo que o agente sempre deve usar como roteador é `AGENTS.md`; o backlog/ordem vem de `docs/08-codex-execution-plan.md`.

## 2. Pré-requisitos

Na raiz do repositório:

```powershell
codex --version
git status --short
```

Se precisar instalar/atualizar a CLI, siga a documentação oficial da OpenAI. O modo não interativo atual é `codex exec <PROMPT>`.

Para automação, confirme os flags disponíveis na sua versão:

```powershell
codex exec --help
```

Os scripts deste pacote usam `workspace-write` e política de aprovação `never`. Nas versões atuais da CLI, a política de aprovação pode precisar aparecer **antes** do subcomando `exec`. Confirme a sintaxe no `codex --help`/`codex exec --help` local antes da primeira execução sem supervisão.

## 3. Sessão 0 — instalar documentação

Uma única vez:

```powershell
git checkout development
git pull --ff-only
git checkout -b chore/docs-v2
```

Aplicar `APPLY-DOCS.md`, validar, commit e revisar. Depois merge manual em `development`.

## 4. Sessão de planejamento

Modo interativo:

```powershell
codex
```

Prompt:

```text
/plan
Leia AGENTS.md, docs/README.md e docs/08-codex-execution-plan.md.
Analise a development atual e proponha as próximas tasks elegíveis.
Não altere arquivos, não crie branch e não implemente nada.
Aponte dependências, conflitos de write scope e quais tasks são seguras para execução noturna independente.
```

Você revisa o plano e atualiza manualmente os estados/Night Queue quando necessário.

## 5. Sessão normal — uma task

Opção simples:

```powershell
codex -a never --sandbox workspace-write exec "Execute a task SEC-001 seguindo AGENTS.md. A branch já deve estar preparada pelo operador. Implemente somente essa task, rode os testes obrigatórios e pare. Não execute operações Git de escrita e não avance para outra task."
```

Ou use:

```powershell
.\scripts\codex-task.ps1 -Task SEC-001
```

## 6. Ordem da primeira fase

Depois de DOCS-001 mergeada:

```text
Sessão 1  → SEC-001
review/merge
Sessão 2  → SEC-002
review/merge
Sessão 3  → SEC-003
review/merge
Sessão 4  → SEC-004
review/merge
Sessão 5  → SEC-005
review/merge
Sessão 6  → SEC-006
review/merge
Sessão 7  → CORE-001
review/merge
Sessão 8  → ACC-001
...
```

Essa fase é propositalmente serial porque DB runtime, RLS e acesso alteram contratos compartilhados.

## 7. Revisão matinal

Na branch produzida pelo Codex:

```powershell
git status --short
git log -1 --oneline
npm run typecheck
npm run lint
npm run test
```

Quando aplicável:

```powershell
npm run build
npm run test:e2e
```

Depois execute revisão Codex contra `development`:

```powershell
codex review --base development
```

Leia achados. Corrija na mesma branch ou peça ao Codex:

```powershell
codex -a never --sandbox workspace-write exec "Leia os achados do review da task SEC-001 fornecidos no contexto/arquivo indicado, corrija somente achados válidos relacionados à task, rode os testes novamente e pare. Não execute operações Git de escrita."
```

Só então faça merge conforme workflow.

## 8. Após merge

Na `development`:

```powershell
git checkout development
git pull --ff-only
npm run typecheck
npm run lint
npm run test
```

Atualize `docs/08-codex-execution-plan.md` em uma pequena branch/chore ou junto do processo de integração:

- task → `done`;
- dependentes satisfeitas → `ready`.

## 9. Execução noturna segura

### Regra principal

Automação noturna **não faz merge**.

O wrapper pode:

- voltar para `development`;
- criar a branch;
- chamar o Codex para editar e testar;
- repetir os gates mínimos fora do sandbox;
- fazer commit se os gates passarem;
- gerar resumo.

O Codex em si não precisa escrever em `.git` durante a execução noturna.

### Uma task por noite/sessão

É o modo mais seguro durante Wave 1 e migrations críticas:

```powershell
.\scripts\codex-task.ps1 -Task SEC-001
```

### Batch noturno

Só usar para tasks independentes cujas dependências já estejam `done` na `development` **antes do batch**.

Edite a chamada explicitamente:

```powershell
.\scripts\codex-night.ps1 -Tasks @("CORE-002", "CORE-004")
```

O script executa uma por vez. O **wrapper** volta para `development` e cria uma branch própria para cada task; o agente só altera o workspace. O batch para se a worktree ficar suja ou um processo retornar erro.

Não colocar tasks dependentes umas das outras no mesmo batch, porque a primeira não será mergeada automaticamente.

## 10. Agendamento Windows

Use o Agendador de Tarefas do Windows para chamar PowerShell no diretório do repo.

Exemplo de argumento:

```text
-NoProfile -ExecutionPolicy Bypass -File C:\caminho\erp-agencia\scripts\codex-task.ps1 -Task SEC-001
```

Para batch:

```text
-NoProfile -ExecutionPolicy Bypass -File C:\caminho\erp-agencia\scripts\codex-night.ps1 -Tasks CORE-002,CORE-004
```

Antes de confiar nisso, execute manualmente uma vez e confirme autenticação, sandbox/approval mode e capacidade de rodar os testes.

## 11. Resultado da sessão

Os scripts gravam a última mensagem em `.codex-results/<task>-<timestamp>.md` quando suportado pela CLI. Essa pasta deve ser ignorada pelo Git.

Resumo esperado:

- task;
- branch;
- commit;
- testes;
- migrations;
- riscos/bloqueios.

## 12. Quando NÃO automatizar

Executar supervisionado:

- migration destrutiva;
- mudança de auth/RLS que ainda não possui teste base;
- backfill financeiro em dados reais;
- importação definitiva da planilha;
- restore/produção;
- merge/release;
- task com decisão de negócio em aberto.

## 13. Prompt curto do dia a dia

Depois que esta documentação estiver no repo, isto é suficiente:

```text
Execute FIN-003 seguindo AGENTS.md. Não avance para outra task.
```

Ou:

```text
Continue com a próxima task ready seguindo AGENTS.md e pare após um commit.
```

Para noite, prefira task ID explícito ou Night Queue aprovada.
