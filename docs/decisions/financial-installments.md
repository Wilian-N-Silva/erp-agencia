# Parcelamento de entradas e saídas

Fonte: áudio da Jaci encaminhado pelo responsável em 30/09/2026, arquivo
`WhatsApp Ptt 2026-09-30 at 11.01.59.ogg` (58 segundos), transcrito localmente.
O áudio complementa o pedido de validação financeira do responsável.

## Comportamento solicitado

“Job” significa trabalho avulso. Pode ser contratado por cliente que já paga fee
mensal (serviço extra não contemplado no contrato) ou por cliente sem fee mensal.
O mesmo cliente pode ter simultaneamente cobrança de fee e cobranças de jobs.
Criar/parcelar um job não altera o contrato, o fee ou o perfil de cobrança do
cliente. A origem de cada lançamento deve distinguir fee de trabalho avulso,
inclusive em relatórios. Não limitar jobs a clientes sem cobrança recorrente nem
tratar todo job como trabalho da Gráfica: o exemplo se aplica ao financeiro geral.

- Entrada: ao cadastrar um job/acordo em 3 parcelas, gerar o título do mês
  inicial e os títulos dos dois meses seguintes automaticamente.
- Saída: ao cadastrar uma compra em 6 parcelas de R$ 2.000,00, gerar os seis
  títulos mensais, totalizando R$ 12.000,00.
- Identificar claramente cada parcela e o total, como “3 de 6” e “5 de 6”.
- Incluir os valores nos meses correspondentes para previsão e consulta.

## Implementação a executar

Oferecer valor total ou valor por parcela, quantidade, primeiro vencimento e
prévia de todos os lançamentos antes de salvar. A soma deve ser exata em centavos,
com eventual diferença de divisão distribuída explicitamente. Vencimentos mensais
devem respeitar meses curtos sem deslocar os meses seguintes indevidamente.
Criar todas as parcelas em uma transação auditada, com proteção contra duplicidade
e validação de cliente/fornecedor/organização. Cada parcela poderá ser conciliada
separadamente; gerar parcelas não significa registrar recebimento ou pagamento.

O campo de competência deve permanecer explícito: parcelamento de vencimentos
não altera automaticamente o mês de reconhecimento de um serviço já prestado.
O fluxo precisa diferenciar obrigação parcelada de provisão recorrente sem fim.

## Estado observado

`src/features/graphics/sale.ts` já cria AR para parcelas informadas uma a uma.
As ações gerais em `src/features/finance/actions.ts` criam um único título por
envio; não geram uma série mensal. O exemplo da câmera é apenas referência do
áudio: não foi cadastrado como despesa real no ambiente de teste.
