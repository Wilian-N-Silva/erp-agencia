# Retomada — ciclos de provisão (FIN-007)

Ponto de retomada solicitado pelo usuário em 02/10/2026 por limite de tokens.
Branch `codex/finance-provision-cycles`, baseada em `development`/`main` `2b464ae`.
Esta branch é trabalho em andamento; não promover para a release antes de concluir
os itens abaixo. O MVP validado permanece em `main` e `development`.

## Implementado nesta branch

- Tabela `provision_cycles`: uma ocorrência por provisão/competência, estimativa,
  vencimento, estado, AP vinculada e motivo de cancelamento.
- FKs compostas por organização, RLS ENABLE/FORCE, checks de estado e valor.
- DAL com RBAC financeiro, Zod estrito, transações, bloqueio de linha e auditoria.
- Planejamento repetido retorna o ciclo existente; provisão não recorrente admite
  uma ocorrência. Provisão inativa não aceita nova ocorrência.
- Realização cria uma AP única, com valor efetivo separado da estimativa, sem
  movimentar caixa. Reenvios/concorrência não duplicam AP. Falha de auditoria
  reverte AP e mudança de estado juntas.
- Cancelamento preserva histórico e exige motivo. Ciclo realizado não pode ser
  cancelado por este caminho; sua obrigação precisa de tratamento financeiro.
- Dois testes unitários e cinco testes de integração novos.

## Migrations e ambiente

`0048_common_microchip.sql` foi gerada pelo drizzle-kit e complementada com RLS;
o índice composto foi ordenado antes da FK que depende dele.
`0049_provision-policy-name.sql` padroniza o nome da policy para a matriz RLS.
Foi criada separadamente porque 0048 já havia sido aplicada no banco de testes.
Ambas foram aplicadas **somente no banco de testes**, sem backfill/limpeza de dados.
Não foram aplicadas na base de uso local. Não há segredo nos arquivos versionados.

## Retomar antes de integrar

1. Concluir FIN-007: ações autenticadas com rate limit, UI, recorrência/próxima
   ocorrência e leitura de previsto versus realizado sem dupla contagem no
   dashboard/exportações. O DAL novo ainda não é chamado por nenhuma tela.
2. Migrations 0048/0049 já cobertas em banco vazio e upgrade desde 0047, com
   preservação das provisões e AP legadas, sem inventar ciclos ou obrigações,
   e conferência da policy RLS final. Revalidar se o schema mudar novamente.
3. Revalidar build/E2E e atualizar manuais. Não anunciar realização de provisões
   disponível ao usuário antes da conexão da interface e dos relatórios.
4. Só então avançar para SAA-004 e cobranças efetivas, com cotação da cobrança e
   encargos separados. Estimativa de contrato não comprova valor cobrado.

O objetivo amplo continua incluindo férias/venda/NF, assinaturas, clientes e
entradas/saídas. Evidências concluídas e lacunas estão nos relatórios da entrega
e de `finance-multiple-receipts-validation.md`; não marcar o goal como concluído.

## Validação deste checkpoint

Typecheck, lint e 408 testes unitários passaram. Os cinco testes novos de banco
passaram na primeira execução. A suíte paralela apresentou quatro falhas: duas
pela convenção de nome da policy (corrigidas por 0049) e duas de contagem global
dos buckets de rate limit durante concorrência com outros arquivos. A repetição
serial usa `npm run test:db -- --fileParallelism=false`.
Resultado da repetição serial: **205 testes aprovados em 33 arquivos**, incluindo
matriz RLS, isolamento da tabela nova, concorrência e rollback. `git diff --check`
também passou.

Build e E2E não foram executados nesta branch em andamento. As worktrees de
validação e SEC-002 foram preservadas. O stash de protótipo/apresentação continua
local, fora desta branch, conforme escopo anterior do usuário.

Atualização de publicação: typecheck, lint, 408 testes unitários e **206 testes
de banco** passaram após acrescentar a cobertura de instalação/upgrade.
Comando de banco: `npm run test:db -- --fileParallelism=false`.
