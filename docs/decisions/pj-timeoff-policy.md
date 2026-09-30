# Política interna PJ — férias/pausas e venda de dias

Fonte: orientações do responsável em 30/09/2026. Todos os integrantes reais são PJ.
Este documento registra a regra comercial solicitada para o sistema, sem inferir
regime CLT ou converter os dados demo existentes.

## Confirmado

- Férias/pausas são remuneradas e usufruídas em blocos de 15 dias.
- Pode haver venda de dias, sujeita à autorização de Jaciane (Jaci).
- O valor final deve permitir definição manual pela responsável.
- Pode existir sugestão de valor para auxiliar; a sugestão precisa explicar sua
  memória de cálculo num diálogo: base, fórmula, dias, arredondamento e resultado.
- A sugestão não substitui autorização nem força o valor final.
- O valor autorizado entra na próxima NF. Exemplo informado: solicitação em
  10/10/2026 autorizada antes da emissão entra na NF emitida ao final de outubro.

## Ainda não definido

O responsável escolheu **informar outra fórmula**, em vez de adotar mensalidade
base/30 ou total com adicionais/30. Não implementar nenhum desses divisores como
regra presumida. A fórmula específica ainda precisa ser fornecida.

Também não foram informados saldo anual contratado, forma de aquisição, definição
de dias corridos/úteis, limite de venda nem regra quando a próxima NF já estiver
emitida. A confirmação de blocos de 15 refere-se ao usufruto; não inferir que a venda
também exige múltiplos de 15. Não adicionar automaticamente um valor de férias
remuneradas sobre a remuneração mensal normal sem definir essa composição.

## Diferença para a implementação atual

O portal usa o nome Pausas para PJ. O formulário atual recebe início/fim e tipo,
mas não venda de dias ou valor. O saldo aquisitivo é exclusivo de CLT no servidor.
A solicitação aceita intervalos fora de 15 dias e sua aprovação apenas muda status.
Não existe vínculo entre solicitação/venda autorizada e item de NF. O campo
`soldDays` isolado no schema não comprova o fluxo. Essas lacunas devem ser tratadas
na implementação, com autorização server-side, tenant, auditoria, transação e
proteção contra inclusão duplicada na NF.
