# Validação PJ, assinaturas e financeiro — 30/09/2026

> Registro histórico, anterior às correções de outubro. Para a entrega atual,
> consulte [MVP de outubro](mvp-october-delivery.md). As pendências abaixo não
> representam sozinhas o estado atual do produto.

Continuação da validação do MVP na branch `codex/user-workflows-manuals`.
Regra nova confirmada: todos os integrantes reais são PJ. A política de blocos
de 15 dias, venda autorizada pela Jaci e inclusão na próxima NF está em
[pj-timeoff-policy.md](../decisions/pj-timeoff-policy.md). Fórmula de sugestão ainda
aguarda informação do responsável; não foi presumido divisor nem adicional.

## Resultado por requisito

| Requisito | Resultado observado |
|---|---|
| Solicitar pausa e RH aprovar | Fluxo básico funciona; E2E usa PJ e RH em sessões separadas |
| Férias em blocos de 15 dias | Não atendido: o formulário e a action aceitam intervalos arbitrários; teste existente solicita 01 a 05/10 e consegue aprovação |
| Venda de dias PJ | Não disponível no formulário; saldo aquisitivo do servidor é exclusivo CLT |
| Venda autorizada entrar na próxima NF | Não implementado: sem valor aprovado/competência/vínculo NF na solicitação e sem item com origem na venda |
| Composição da NF chegar ao PJ | Funciona pela publicação manual do Financeiro; itens/total/descritivo exibidos ao PJ |
| Retorno do PDF de NF | Upload, download com comparação dos bytes, ajuste, reenvio e aprovação funcionam no fluxo testado |
| Conferência financeira da NF | Perfil somente Financeiro continua sem acesso ao download (HTTP 500); Diretoria consegue; pagamento da NF permanece legado |
| Cadastrar assinaturas | Cadastro fictício de R$ 123,45 confirmado pela interface e no banco; testes adicionais usam R$ 87,65 |
| Excluir completamente cadastro errado | Não disponível: não existe ação exportada de exclusão nem controle na interface. Não foi executado DELETE por SQL para simular essa função |
| Cancelar assinatura | Altera e persiste status cancelled; preserva cadastro e histórico. Não cancela contrato no fornecedor externo |
| Custos após cancelamento | Defeito: indicador soma canceladas. Com R$ 1.200,00 ativa e R$ 123,45 cancelada, mostrou mensal R$ 1.323,45 e anual R$ 15.881,40 |
| Cobrança automática de assinatura | Não implementada: actions SaaS não geram AP/provisão/movimentação. Valores são cadastro/estimativa, não cobrança financeira |
| Cliente recorrente → entrada | Cadastro, fee R$ 321,45, competência 10/2026 e recebimento integral conciliado verificados |
| Saída/pagamento | Fluxo da Gráfica cria AP R$ 1.200,00 e concilia saída; persiste após recarga |

O teste financeiro da Gráfica também valida recebimento de R$ 1.950,00 em duas
parcelas, bloqueio de alocação acima do título, sugestão e confirmação pelo
Financeiro. Isso não declara todos os módulos financeiros homologados: NF,
reembolso e assinatura ainda possuem lacunas de integração específicas.

## Evidência

- `tests/e2e/subscription-client-audit.spec.ts`: novo cliente, cobrança mensal,
  entrada, conciliação e assinatura/cancelamento.
- `tests/e2e/portal-invoice-workflow.spec.ts`: pausa PJ, NF e reembolso.
- `tests/e2e/graphics-os.spec.ts`: entrada/saída, AR/AP e conciliação.
- Inspeção via agent-browser em localhost: cadastro e cancelamento da assinatura
  `QA-SET30-Assinatura-cadastro-errado`; screenshots em
  `storage-local/manual-validation/sep30-saas*.png`.
- Consulta read-only no banco confirma assinaturas e lançamentos QA: transações
  de entrada de R$ 321,45 com status reconciled e alocação de R$ 321,45.
- Código relevante: `src/features/timeoff/actions.ts`, `src/features/saas/actions.ts`,
  `src/app/(private)/app/assinaturas/saas-view.tsx`, `src/features/portal/actions.ts`.

Os registros QA foram mantidos, inclusive tentativas intermediárias. Não foram
alterados colaboradores reais, senhas, permissões ou contratos externos. A exclusão
física solicitada não foi realizada porque falta funcionalidade de produto;
cancelamento não foi apresentado como se fosse exclusão.

## Pendências de implementação

1. Modelar férias remuneradas PJ e usufruto em blocos de 15, sem aplicar automaticamente
   saldo/regra CLT. Definir aquisição e contagem antes de criar validações de saldo.
2. Implementar venda com autorização por papel/escopo destinado à Jaci, valor final
   manual, sugestão explicada conforme fórmula a fornecer e vínculo idempotente à
   próxima NF. Não cadastrar Jaci nem atrelar autorização a nome em texto.
3. Implementar exclusão de cadastro errado de assinatura com autorização, verificação
   de vínculos e auditoria; preservar histórico financeiro onde houver obrigação.
4. Separar custo corrente de cadastro histórico e excluir canceladas dos indicadores
   de compromissos correntes. Criar fluxo de cobrança recorrente antes de anunciar AP automática.
5. Concluir os vínculos NF/reembolso com o financeiro novo e acesso ao PDF pelo revisor.

Nenhuma migration foi criada nesta validação. O pedido de sugestão com memória de
cálculo continua pendente da fórmula escolhida pelo responsável.

Gates: 5 cenários E2E direcionados passaram, 373 testes unitários e 164 de banco
passaram. Typecheck/lint aprovados. Build de runtime não foi alterada; os testes
executaram a build já existente. Os cenários documentam limitações observadas;
um teste de cancelamento aprovado não significa que exclusão/cobrança existam.
