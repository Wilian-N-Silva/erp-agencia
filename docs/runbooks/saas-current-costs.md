# Custo corrente de assinaturas

Correção pontual encontrada na validação de cadastro/cancelamento de SaaS
(domínio SAA, PRD 05). Não conclui SAA-001 nem a integração financeira SAA-004.

Os indicadores de custo mensal e anualizado excluem assinaturas com status
`cancelled`. O contrato cancelado continua consultável com seu valor histórico.
`cancel_scheduled` permanece no total até o cancelamento efetivo. Suspensão e
período de teste não presumem gratuidade: seu valor cadastrado continua somado.

O custo anualizado é uma estimativa de 12 vezes o custo mensal corrente, não uma
cobrança, conta a pagar ou despesa realizada. Ambos consideram apenas os custos
visíveis ao perfil. Busca e filtros da lista não alteram a base desses indicadores.
O cálculo soma centavos inteiros, sem alterar os valores persistidos.

Segurança: alteração restrita ao cálculo de apresentação; autenticação, RBAC,
DAL por organização, RLS e ocultação de custos continuam no servidor. Não há nova
entrada externa, mutação, ID recebido, upload, sessão, auditoria ou transação.
Nenhuma migration ou backfill é necessário.

Regressão: `src/tests/saas-current-costs.test.ts` cobre cancelamento, estados
restantes, custos restritos, valores ausentes e centavos. O E2E
`tests/e2e/saas-current-costs.spec.ts` cadastra uma assinatura fictícia de R$ 87,65,
confere os acréscimos mensal/anual, cancela, recarrega e verifica a volta aos totais
anteriores e a preservação do contrato cancelado.

Validação em 30/09/2026, branch `codex/saas-current-cost`: typecheck, lint,
377 testes unitários, build e os 6 E2E da branch aprovados. `git diff --check`
sem erros. Navegador local: custo mensal de R$ 1.287,65 e anualizado de
R$ 15.451,80 correspondentes às duas assinaturas ativas; três canceladas
permanecem na lista e não entram nos indicadores. Console sem erros.
Evidência local: `storage-local/manual-validation/saas-current-costs.png`.

Build/E2E ainda emitem avisos preexistentes de HTTP no ambiente local e
depreciação de consultas concorrentes no driver PostgreSQL. Esta correção não
implementa exclusão de cadastro errado, geração automática de cobranças SaaS
nem os ajustes pendentes de férias/venda de dias e NFs PJ.
