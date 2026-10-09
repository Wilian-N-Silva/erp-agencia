# Matriz inicial e backlog

O plano antigo não define o estado. Evidência inicial é código/commits/testes
existentes; resultados históricos ainda exigem revalidação no candidato isolado.

| Capacidade | Estado inicial e evidência | Dependência / risco | Prioridade |
|---|---|---|---|
| Clientes com/sem fee | Implementado: `clients/actions.ts`, `client-optional-billing.test.ts` | Cobrança manual ainda pode marcar recebida sem caixa | P0 |
| Fornecedores/contas/categorias/centros | Implementado: `finance-master-data`, testes master-data/upgrade | Conferir vínculos, desativação e telas integradas | P1 |
| Projetos/referências | Schema e formulários gráficos existentes | Confirmar cadastro acessível sem intervenção técnica | P1 |
| Trabalho/cotação/aprovação/OS/cliente | Implementado: `graphics`, migrations 0024..0030, E2E graphics-os | Preservar estados e versões; revalidar ponta a ponta | P1 |
| Contratação AP / venda parcelada AR | Implementado: `commitment.ts`, `sale.ts`, testes integração | Edição/cancelamento legado pode divergir dos registros imutáveis de origem | P0 |
| Produção/entrega/encerramento | Implementado: `production.ts`, eventos imutáveis e E2E | Encerramento separado de quitação | P1 |
| Arte final | Implementado em `f3762ec`: upload/versionamento/download e E2E | Revalidar permissões e persistência após restart | P1 |
| Dashboard/histórico/importação | Implementado e testado: `finance-summary`, `import-*`, E2E graphics-import | Resumo usa cache e compara alocações; validar legado/estorno | P0 |
| Movimentações/conciliação | Implementado: `finance-transactions`, `finance-allocations`, integração concorrente | Alocações imutáveis; saldo contempla baseline legado | P0 |
| Cutover FIN-010 | Incompleto: `markFinancialEntryReceivedAction`, `markFinancialExpensePaidAction`, `markClientPaymentReceivedAction` gravam baixa direta | Fechar também servidor e leituras, preservar legado explicitamente | P0 |
| Estorno FIN-006 | Ausente no código: status reversed existe, sem fluxo de estorno; permissão finance.reverse ausente | Exige registro imutável, transação, recálculo, RBAC, migration expansiva | P0 |
| Correção/cancelamento títulos | Edição e cancelamento diretos em `finance/actions.ts` | Valor pode cair abaixo do liquidado; falta motivo e proteção de origens | P0 |
| Provisões/ciclos | Implementado 0048/0049 e `provisions`, E2E provision-cycles | Não somar previsão realizada com AP; preservar recorrência | P1 |
| Documentos financeiros FIN-008 | OS/NF/arte existem; AR/AP/movimentação sem UI de comprovantes identificada | Upload seguro e download específico ainda necessários | P1 |
| Relatórios FIN-009 | Dashboard e CSV/XLSX existem | Recebido/pago por competência do título não representa caixa por occurredAt; atrasado soma original, não saldo | P0 |
| Outras origens financeiras | NF vinculada AP; SaaS efetivo implementado cc1a0a6; reembolso direto legado | Auditar todos os writers de paid/received, evitar fonte paralela | P0 |
| RBAC/RLS/auditoria/rate limit | Fundamentos e testes existentes | Perfil Gráfica restrito e grants do novo estorno; novos writes devem manter proteções | P0 |
| Ambiente/gates | Baseline histórico 430 unitários, 211 DB estimados; último E2E completo 15/18 | Dados QA/paginação/login compartilhado e ambiente não isolado; não aceitar como gate verde | P0 |

## Ordem técnica

1. HML-01: reconhecimento, documentação, ambiente isolado e baseline de gates.
2. HML-02: bloquear baixas diretas no servidor/UI; explicitar histórico legado e
   blindar edição/cancelamento de títulos e origens financeiras.
3. HML-03: estorno/correção auditável compatível com alocações imutáveis, recálculo
   integrado, autorização e testes negativos/concorrência/rollback.
4. HML-04: fontes de leitura e relatórios consistentes (caixa, competência,
   obrigações, saldo e legado), incluindo Clientes e Gráfica.
5. HML-05: comprovantes/anexos financeiros, referências/projetos e perfil restrito.
6. HML-06: E2E integrado completo, importação, permissões, restart e todos os gates.
7. HML-07: candidato revisado, documentação de preparo, fixtures/roteiro, limites,
   riscos, evidências e SHA final. Sem promoção automática a main.

Tasks executadas em commits pequenos na branch dedicada, conforme autorização
explícita deste Goal de percorrer o backlog integrado; não atualizar tarefas antigas
para done com base apenas na existência de código.

## Atualização após o reconhecimento

HML-01 tem ambiente DB e E2E isolados preparados e baseline unitário/banco verde.
HML-02 bloqueou os três endpoints de baixa direta e substituiu as ações da UI;
fontes históricas e correções de títulos ainda estão em trabalho.
HML-03 implementou estorno de movimentação com histórico imutável e saldo reaberto,
testado em banco e navegador (`abce9c0`). Revisão de relatórios/integridade e E2E
integrado obrigatório continuam pendentes antes do aceite técnico do candidato.

Em `09f05e5`, correções/cancelamentos passaram a exigir motivo, lock tenant,
auditoria e proteção de liquidação/origens; 220 DB e 444 unitários aprovados.
Em `d65a67f`, vencidos considera saldo parcial restante. Em `c773ccc`, relatório
de caixa consulta eventos e estornos por data sem somar conciliações novamente;
446 unitários, 221 DB, build e dois E2E focais aprovados. Legado explícito,
correções das origens, reembolso avulso, documentos/perfis e E2E completo continuam
na fila. Não há ainda candidato técnico aprovado para homologação.

Em `d6b1e00..f21468d`, reembolso avulso passou a gerar AP única, mutuamente
exclusiva à inclusão em NF. Baixa direta do servidor removida. Portal/gestão
derivam pagamento de conciliações ativas, com reabertura após estorno; histórico
sem vínculo preservado. 0053 expansiva aplicada somente em testes, sem backfill.
Upgrade 0050→0053, 450 unitários, 227 DB e build verdes. E2E focal em `c9bf573`
aprovou solicitação/aprovações/cadastro financeiro/AP/parcial/quitação/estorno.
FIN-010 ainda exige leitura explícita do legado das demais obrigações.
## Incremento de leitura financeira canônica

FIN-010: alocações ativas são a fonte do valor conciliado em AR/AP, Cliente,
Gráfica e alertas. Reserva legada explícita nas migrations 0054/0055 evita
duplicar pagamentos e é sinalizada nas telas/exports. Cache deixa de alterar
totais confiáveis. Testes de upgrade, reserva, estorno e isolamento adicionados.
Gates e evidências finais deste incremento em `progresso.md`.

Pendência P0 para bases históricas: procedimento de revisão auditável das
reservas e levantamento de inconsistências antes da migração. Não resolver
alterando caches nem criando movimentos sem evidência. Correções de títulos
originados na Gráfica/NF/SaaS/provisão ainda exigem conclusão no domínio de
origem. Esses pontos impedem declarar a V1 pronta neste checkpoint.
## FIN-008 — incremento de comprovantes

Implementados anexos versionados em AR/AP/movimentações sobre files/documents
existentes, sem migration/backfill. Vínculo financeiro tenant, permissões de
leitura/escrita, validação de conteúdo, rate limit de upload, transação/audit e
compensação de storage. Downloads usam rota privada auditada existente com
checagem adicional do dono financeiro. Histórico protegido da exclusão genérica.
Gates/resultados exatos em progresso.md; gate completo do candidato precisa
ser repetido após os demais incrementos. Restart e cobertura integrada de AP
com documentos ainda requerem evidência final.

## Incrementos CORE/GRF e revisão legada

`62a2eec..6f07658`: cliente protegido após OS/vínculo financeiro e trabalho com
AP/AR não pode ser arquivado. Banco/servidor/UI cobertos; encerramento continua
separado de quitação. Build e E2E integrado verdes.

`d895330..cd00f93`: Histórico de AR/AP permite liberação explícita de reserva
conferida, com motivo/evidência/finance.reverse. Baseline preservado e nenhuma
movimentação de caixa criada. Leituras integradas, capacidade de conciliação e
estorno consideram o restante. 462 unitários, 236 DB, typecheck/lint/build e E2E
focal verdes. Migrations 0057/0058 somente em bancos isolados. Suite E2E completa
em execução no checkpoint; correção das origens e demais aceites seguem abertos.

Problema concreto na próxima origem: provisão realizada direciona a correção ao
Financeiro, que corretamente recusa alteração econômica de título gerado. É
necessário corrigir pela ocorrência, preservando estimativa/link/AP/auditoria e
recusando saldo liquidado até estorno/revisão. Não recriar provisões/ciclos.
