# Assinaturas em moeda estrangeira e periodicidade anual

Atualização 09/10/2026: cadastro por moeda/ciclo, estimativa manual e registro da
cobrança efetiva com AP foram implementados em `SAA-004`.

Requisito informado pelo responsável em 30/09/2026: existem assinaturas em euro,
dólar e reais, inclusive anuais; IOF pode aparecer depois/separado da cobrança e
a cotação do cadastro pode diferir da cotação efetiva.

## Modelo proposto

Separar contrato, previsão e cobrança efetiva:

- Contrato: moeda original BRL/USD/EUR, valor por ciclo, periodicidade mensal ou
  anual, próxima cobrança e responsável. Preservar o valor original.
- Previsão: conversão estimada em BRL com cotação, data e fonte identificadas;
  IOF/tarifas previstos separados, sem aplicar uma alíquota presumida universal.
- Cobrança: valor original, valor efetivo em reais, data, cotação efetiva e
  encargos. Confirmar a partir do extrato/fatura. Uma cotação nova não reescreve
  cobranças anteriores.
- IOF e tarifas podem ser registrados posteriormente como encargos vinculados à
  cobrança e conciliados com movimentações separadas quando assim vierem no extrato.
- Custo total efetivo é principal em BRL mais encargos confirmados. Não contar
  novamente o IOF se o valor informado já o incluir: o formulário deve explicitar
  se o total de extrato inclui encargos.
- Assinatura anual: previsão/pagamento integral no vencimento anual; equivalente
  mensal apresentado separadamente como estimativa de custo, sem inventar doze
  pagamentos mensais. Periodicidade não altera o histórico de caixa.

## Integração e limites

Gerar obrigação por ciclo com chave única contrato/ciclo, somente uma vez;
pagamento/encargos derivam de conciliação financeira. Atualização da previsão
de câmbio não liquida títulos e não altera valores realizados.

O contrato preserva moeda/ciclo e a estimativa não altera cobranças históricas. A
aba de cobranças registra manualmente o valor original, câmbio efetivo, principal
em BRL, IOF, tarifas, total da fatura e competência. Cada competência cria uma
única conta a pagar vinculada ao registro da cobrança; o pagamento continua sendo
conciliado no Financeiro.

A cotação estimada continua manual no contrato. Não fixar taxa de câmbio ou
alíquota de IOF no código; os valores efetivos vêm da fatura/extrato e ficam
congelados na competência registrada.
