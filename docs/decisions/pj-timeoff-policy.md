# Política interna PJ — férias/pausas e venda de dias

Fonte: orientações do responsável em 30/09/2026 e confirmação de Jaciane (Jaci)
repassada na mesma conversa. Todos os integrantes reais são PJ. Esta decisão
registra a regra comercial do sistema, sem inferir regime CLT.

## Confirmado

- Férias/pausas remuneradas em blocos de 15 dias, com possibilidade de vender
  um bloco de 15 dias mediante autorização da Jaci.
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

Saldo anual, aquisição de saldo, dias corridos ou úteis para o intervalo de
descanso, limites de venda além do bloco de 15 e tratamento da NF já emitida
ainda não foram detalhados. Não presumir essas regras nem gerar um adicional
automático por simples usufruto de pausa remunerada. A confirmação acima
substitui o registro anterior de fórmula pendente.

## Implementação pendente

O portal atual recebe início/fim e tipo da pausa, mas não a venda de dias e seu
valor. O saldo aquisitivo existente é exclusivo de CLT. Ainda faltam validação
dos blocos PJ, sugestão documentada, autorização do valor e vínculo idempotente
entre venda aprovada e item da próxima NF. O campo isolado `soldDays` não comprova
esse fluxo. Exigir autorização server-side, tenant/RLS, auditoria e transação.
