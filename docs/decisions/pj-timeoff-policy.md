# Política interna PJ — férias/pausas e venda de dias

Fonte: orientações do responsável em 30/09/2026 e confirmação de Jaciane (Jaci)
repassada na mesma conversa. Todos os integrantes reais são PJ. Esta decisão
registra a regra comercial do sistema, sem inferir regime CLT.

## Confirmado

- Férias/pausas remuneradas em dias corridos. **15 dias é o padrão inicial**,
  mas a quantidade pode ser alterada conforme combinado (por exemplo, 10 dias).
  Venda e descanso dependem da autorização da Jaci.
- Cada 12 meses completos desde o início do vínculo geram 30 dias, com saldo
  não utilizado acumulado para os períodos seguintes.
- A sugestão considera a **remuneração mensal base vigente**, mesmo quando o
  contrato não foi atualizado. Não usar automaticamente o valor antigo do contrato.
- Fórmula: **remuneração mensal base vigente ÷ 30 × dias vendidos**.
  Para 15 dias, equivale à metade da remuneração mensal atual.
- Ajuda de custo e reembolsos não entram na base. O transporte do exemplo
  histórico foi substituído por ajuda de custo fixa de R$ 300,00 no home office.
- O diálogo deve explicar a origem e vigência da base, divisor, quantidade de
  dias, arredondamento e resultado. Não arredondar a diária antes de multiplicar;
  arredondar o resultado monetário final para centavos.
- A sugestão deve ser aplicada de forma explícita. O valor final permanece
  editável e sujeito à autorização; não é aprovação automática.
- O valor autorizado entra na próxima NF. Solicitação em 10/10/2026, aprovada
  antes da emissão, pode entrar na NF emitida ao final de outubro.

Exemplos: R$ 3.900,00 ÷ 30 × 15 = R$ 1.950,00. Com remuneração atual de
R$ 4.500,00, a sugestão é R$ 2.250,00, ainda que o contrato registre R$ 3.900,00.
R$ 300,00 de ajuda de custo e R$ 200,00 de reembolso continuam itens separados.

## Tempo de vínculo e referência de férias

A gestão deve visualizar o tempo atualizado de vínculo de cada PJ e quando
chega a referência de férias. Essa referência não obriga o descanso naquela data:
mostrar separadamente a data de referência e o período efetivamente solicitado
e aprovado. Não classificar automaticamente o colaborador como em férias nem
criar uma solicitação ao atingir a referência.

O cadastro já possui início e fim de vínculo (`employees.startDate/endDate`).
A periodicidade foi confirmada: **a cada 12 meses desde o início do vínculo**.
Não reaproveitar automaticamente o prazo concessivo CLT para os PJs.

## Decisões ainda abertas

Tratamento da NF já emitida ainda não foi detalhado. Não gerar um adicional
automático por simples usufruto de pausa remunerada. A confirmação acima
substitui o registro anterior de fórmula pendente.

## Implementação em validação na branch `codex/pj-sale-estimate`

O portal recebe descanso ou venda, inicia em 15 dias e permite outra quantidade
com o combinado descrito. Pedidos pendentes reservam saldo acumulado; aprovação
move a reserva para descanso aprovado/venda, e recusa devolve a reserva. Ausências
continuam em formulário separado e não consomem o saldo de férias PJ.

Um administrador configura a conta da responsável em `/app/ferias`. A identificação
usa o ID da conta, nunca apenas o nome "Jaci". Aprovação exige essa conta e a
permissão `timeoff.write`; venda exige também `compensation.read`. A base e a
sugestão são recalculadas na aprovação; o valor autorizado é preenchido explicitamente
e divergência exige justificativa. Operações são auditadas em transações tenant-aware,
com lock do colaborador para proteger reservas concorrentes.

A venda aprovada é vinculada uma única vez à primeira composição aberta, sem PDF,
de competência igual ou posterior ao mês da aprovação. Se não existir composição
elegível, aguarda a próxima criação. NF já enviada não é modificada. O envio posterior
do PDF preserva o item e o total. Descanso não adiciona remuneração extra à NF.

A migration aditiva `0045_worried_wallow.sql` preserva solicitações antigas e não
atribui valor ou autorização retroativa a `soldDays` legado. Esses registros precisam
de conferência operacional caso devam ser pagos. O vínculo novo usa chave única
no item da NF. As policies RLS existentes continuam protegendo as tabelas.

Esta entrega não conclui a integração NF → contas a pagar → conciliação (INV-001..004),
nem o fluxo de cancelamento/reabertura de férias (VAC-003). Não marcar esses cards
como concluídos pelo resultado dos testes de venda e envio do PDF.
