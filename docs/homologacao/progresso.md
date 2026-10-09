# Progresso e evidências

## 09/10/2026 — HML-01 em andamento

Baseline `f3762ec`; árvore limpa; main/development sincronizadas. Migrations
0000..0050. Últimos commits: arte final, cobrança efetiva SaaS, fixtures PJ e ciclos.
Worktrees preexistentes SEC-002 e invoice-download-validation e stash de mockup
preservados. Banco local existente e servidor localhost:3000 não serão usados para
testes destrutivos. Nenhum deployment ou alteração de dados nesta auditoria.

Lidos AGENTS, índice, PRDs Core/Financeiro/Gráfica, execução, segurança, testes,
migrations, workflow e runbooks de entrega/ambiente/validação financeira.
Runbooks históricos contêm lacunas já corrigidas por commits mais recentes;
matriz distingue essas evidências de itens realmente ausentes.

Achados confirmados: baixa direta em três ações ainda ativas; leituras financeiras
aceitam cache/status histórico; estorno não implementado; alocações protegidas por
trigger imutável (0023). Relatório de atrasados soma valor original em vez do saldo.
Reconhecimento continua em comprovantes, projetos, permissões e todas as origens.
Próximo: ambiente descartável independente e gates baseline antes do cutover.

## HML-01 — baseline isolado / HML-02 — primeira proteção

Criado container PostgreSQL exclusivo da homologação em loopback:15433, diferente
de `erp-agencia-postgres`. Banco novo `erp_hml_dbtests`, migrator BYPASSRLS e app
NOBYPASSRLS/não owner. Nenhum banco preexistente removido; migrations 0000..0050
aplicadas com sucesso. Credenciais ficam somente em arquivo `.env.*` ignorado.
Baseline: lint verde, 430 unitários, 211 integração/segurança/migration em 34 arquivos
com `npm run test:db -- --fileParallelism=false` (55,33 s).

Baixas diretas de AR/AP/Clientes rejeitam chamadas no servidor após autenticação,
permissão, rate limit e validação, sem ler/escrever títulos. Botões agora abrem
movimentações/conciliação. Três regressões testam rejeição inclusive com autorização
e limite disponível. Nenhum dado histórico modificado. 433 unitários e lint verdes.
Logs locais: `storage-local/homologacao/baseline-*` e `cutover-*`.

Esta proteção não conclui FIN-010: ainda faltam fontes de leitura legadas explícitas,
guards de edição/cancelamento e demais origens. Build/E2E desta candidata ainda
pendentes; testes históricos não serão apresentados como aprovação desta V1.
