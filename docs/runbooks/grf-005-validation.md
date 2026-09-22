# GRF-005 — Registro de OS e documento

Implementação em `codex/graphics-os-registration`, a partir de `development` (`84bc8b6`).

## Comportamento e aceite

- Após aprovação interna de uma cotação, o detalhe do trabalho permite registrar número, data, valor apresentado ao cliente e PDF da OS externa.
- O registro move o trabalho para `client_approval_pending`. A aprovação pelo cliente pertence à GRF-006.
- Revisões exigem motivo, criam uma versão imutável e preservam o PDF anterior. Usuário, data e valores ficam registrados no histórico e na auditoria.
- Repetir um número em outro trabalho da mesma organização gera aviso após salvar, sem impedir o registro. Não revela trabalhos de outra organização.
- PDFs são privados, validados no servidor e baixados por rota autenticada com auditoria e `Cache-Control: private, no-store`.

## Arquivos

- `src/features/graphics/os-{rules,dal,registration}.ts`: validação, consultas e registro transacional.
- `src/features/graphics/actions.ts`: entrada da ação e limitação de uploads.
- `src/app/(private)/app/grafica/os-form.tsx`, `[id]/page.tsx` e `[id]/os/[versionId]/download/route.ts`: formulário, histórico e download.
- `src/lib/db/schema.ts`, `rls-policy-matrix.ts`, `drizzle/0026_*`, `0027_*`, `0028_*` e metadados: tabela de versões, FKs de organização, RLS forçada e imutabilidade.
- `next.config.ts`: limite de transporte de 12 MB para acomodar o limite existente de arquivos de 10 MB e o envelope do formulário.
- `src/tests/graphics-os*.test.ts`, `tests/integration/graphics-os*.test.ts`, `tests/e2e/graphics-os.spec.ts`: validação, download, isolamento, concorrência, rollback, upgrade e fluxo UI.

DOC-002 ainda não oferece um serviço global de documentos versionados. O suporte indispensável foi implementado somente para OS, reutilizando `files`, storage e validação existentes, sem antecipar o módulo global de documentos.

## Migrações e segurança

0026 cria a tabela; 0027 aplica RLS e trigger de imutabilidade; 0028 normaliza o nome da policy para o contrato `_tenant_isolation`. A correção é separada porque as anteriores já haviam sido aplicadas localmente. Não há backfill nem remoção de dados existentes. Backup local antes da aplicação: `storage-local/manual-validation/pre-grf005.dump`.

Autenticação e RBAC são verificados no servidor; DAL, RLS e FKs compostas limitam organização e impedem IDOR. Payload estrito rejeita mass assignment. Upload usa limiter persistente, limite de tamanho, MIME/extensão, assinatura PDF e marcador de final; não inclui antivírus. Storage não é exposto por URL pública. Erros não devolvem detalhes internos. Bloqueio do trabalho e versão esperada evitam sobrescrita concorrente. Arquivo, versão, status e auditoria são transacionais; falha remove o objeto enviado. A task não modifica sessões, concessões de acesso ou lançamentos financeiros.

## Validação em 21/09/2026

- `npm run typecheck`, `npm run lint`, `npm run build`: aprovados.
- `npm run test`: 43 arquivos, 336 testes aprovados.
- `npm run test:db`: 24 arquivos, 145 testes aprovados, incluindo migração de base 0025, instalação limpa, RLS, rollback de auditoria e concorrência.
- `npm run test:e2e -- --workers=1`: 4 testes aprovados; cadastro, duas versões e preservação do download anterior verificados.
- A primeira execução concorrente passou a GRF-005, mas um teste preexistente de login recebeu HTTP 429. A execução sequencial passou sem desligar o limiter; o novo teste respeita `Retry-After` caso necessário.
- Inspeção visual em `localhost:3000`: formulário de OS disponível no trabalho QA aguardando OS. Credenciais e dados demo locais existentes preservados.
- `git diff --check`: aprovado. Worktree preexistente `erp-agencia-codex-worktrees/sec-002` limpa e preservada.

O E2E depende dos dados locais de validação (cliente Horizonte Eventos, responsável Lideranca Demo e Fornecedor QA Grafica B), de `DEMO_USER_PASSWORD` e das migrações aplicadas. Logs ficam em `storage-local/manual-validation/`, ignorados pelo Git. A etapa posterior de aprovação do cliente continua fora deste aceite.
