# Documentação oficial — Sistema Interno FG

Esta pasta é a fonte de verdade do produto a partir da documentação v2.

Baseline auditada: repositório `Wilian-N-Silva/erp-agencia`, branch `main`, referência observada em 2026-08-17 com último commit público do baseline `0b7103dd385daf774965782b55612b2e16fc5941` (`fix(portal): redirect users without organization`). O código real sempre prevalece quando houver divergência operacional não incorporada nesta documentação.

## Ordem de leitura

### Para humanos

1. `00-contexto-e-decisoes.md`
2. PRD do domínio relevante (`01` a `05`)
3. `06-security-and-rls.md`
4. `07-test-strategy.md`
5. `08-codex-execution-plan.md`
6. `09-migration-rollout.md`
7. `10-codex-operations.md`

### Para Codex/agentes

O agente deve começar por `AGENTS.md` na raiz e então seguir as referências deste README.

## Documentos atuais

| Arquivo | Papel |
|---|---|
| `00-contexto-e-decisoes.md` | Contexto, decisões de produto, glossário e limites |
| `01-prd-core-erp.md` | Correções transversais, clientes, pendências, dashboard e padrões de estado |
| `02-prd-financeiro.md` | AR/AP, caixa, conciliação, contas, provisões e integrações |
| `03-prd-grafica.md` | Fluxo operacional completo da Gráfica |
| `04-prd-pessoas-e-portal.md` | Usuários, acesso, pessoas, férias, lifecycle, NFs e reembolsos |
| `05-prd-governanca.md` | Equipamentos, acessos externos, SaaS e documentos |
| `06-security-and-rls.md` | Segurança, RLS, rate limiting, validação, auditoria e sessão |
| `07-test-strategy.md` | Estratégia e gates de testes |
| `08-codex-execution-plan.md` | Backlog atômico, dependências, waves e branches |
| `09-migration-rollout.md` | Migrations, backfill, rollout e rollback |
| `10-codex-operations.md` | Como operar o Codex por sessão e à noite |
| `git-workflow.md` | Fluxo Git oficial — preservado |
| `implementation-log.md` | Log cronológico de execução — preservado e continuado |

## Documentação histórica

Tudo em `archive/` é histórico. Não é especificação para novas implementações, salvo quando um PRD v2 referenciar explicitamente uma decisão antiga.

## Runbooks

`runbooks/` continua sendo fonte operacional para backup/restore, staging e produção. Alterações em segurança, credenciais de banco e RLS devem gerar atualização dos runbooks na mesma task que muda o comportamento operacional.

## Regras de precedência

Em caso de conflito:

1. requisito explícito da task atual;
2. PRD v2 do domínio;
3. segurança/RLS e estratégia de testes;
4. contexto/decisões v2;
5. código atual, quando não contradiz requisito novo;
6. documentação em `archive/` somente como referência histórica.

Nunca usar um documento arquivado para desfazer silenciosamente uma decisão v2.

## Estado das tasks

O estado oficial fica em `08-codex-execution-plan.md` e só deve ser alterado pelo integrador após revisão/merge.

Estados:

- `blocked`: dependência não integrada;
- `ready`: pode começar a partir da `development`;
- `in_review`: branch concluída aguardando revisão/merge;
- `done`: integrado em `development` e validado;
- `deferred`: deliberadamente adiado;
- `cancelled`: requisito removido com decisão documentada.
