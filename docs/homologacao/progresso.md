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
