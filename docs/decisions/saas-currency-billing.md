# Assinaturas em moeda estrangeira e periodicidade anual

Atualização 02/10/2026: cadastro por moeda/ciclo e estimativa manual documentada
implementados em [saas-currency-cycle](../runbooks/saas-currency-cycle.md).
O restante deste texto distingue o modelo alvo da cobrança efetiva ainda pendente.

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

O modelo atual possui apenas `monthlyCost`, sem moeda/ciclo/registro de cobrança.
Os indicadores existentes não comprovam suporte a câmbio ou IOF. Esta evolução
pertence ao modelo SaaS (SAA-001) e integração financeira (SAA-004), devendo ser
implementada e testada antes de ser anunciada como disponível.

Decisão técnica pendente: cotação estimada manual ou integração com provedor;
em ambos os casos o valor efetivo do extrato deve poder ser informado. Não fixar
taxa de câmbio ou alíquota de IOF no código com base apenas neste documento.
