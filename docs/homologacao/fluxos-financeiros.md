# Fluxos financeiros em validação

Este roteiro descreve o código da branch de homologação. Não é declaração de
aceite da diretoria nem de prontidão completa da V1.

## Obrigações e caixa

Uma conta a receber/pagar registra uma obrigação, com competência e vencimento.
Gerar parcelas de uma venda não registra recebimento. Contratar um fornecedor
não registra pagamento. Concluir um trabalho gráfico não quita esses títulos.

Depois de confirmar uma entrada/saída efetiva, acesse **Financeiro → Movimentações**,
escolha a conta financeira, direção, valor, data e contraparte. Registre somente
uma movimentação para cada evento de dinheiro. Use **Conciliar** para distribuir
o valor entre os títulos correspondentes e confirme a conferência dos valores.
É possível distribuir parcialmente e entre vários títulos, respeitando os
saldos. A alocação identifica a obrigação; não cria outra movimentação.

Exemplo fictício: uma venda de R$100 pode ter recebimentos de R$40 e R$60.
Registre duas movimentações apenas se esses forem dois eventos efetivos. Cada
conciliação atualiza o saldo da mesma obrigação em Financeiro, Cliente e Gráfica.
Não use uma baixa direta: os endpoints antigos de AR/AP/Cliente são recusados.

## Movimento registrado por engano

No detalhe da movimentação, um usuário com `finance.reverse` informa o motivo
e confirma **Estornar movimentação**. O registro original e suas conciliações
continuam disponíveis como histórico. O estorno reabre os saldos correspondentes
e permite registrar/conciliar o movimento correto. Repetir o mesmo estorno não
cria uma segunda compensação. O sistema não faz transferências bancárias.

## Correção ou cancelamento da obrigação

Em AR/AP, **Editar** e **Cancelar** exigem justificativa. A auditoria preserva
dados anteriores/posteriores e o motivo. Uma obrigação cancelada não pode ser
reaberta pela edição. O valor não pode ficar abaixo da liquidação acumulada;
para trocar uma contraparte liquidada, estorne primeiro os movimentos indevidos.
Cancelar exige ausência de liquidação, inclusive de baixas históricas.

Títulos com origem explícita na Gráfica, NF, SaaS ou provisão permitem ajustes
documentais/vencimento, mas protegem valor, contraparte, competência, recorrência
e cancelamento para não contradizer os dados da origem. O procedimento controlado
para desfazer esses fatos integrados ainda está no backlog V1; não se deve editar
diretamente o banco para contornar a proteção.

## Reembolso avulso

Após aprovação financeira, **Gerar conta a pagar** permite escolher competência,
vencimento, categoria de despesa e centro de custo. O valor é o aprovado no pedido.
Se não houver categoria elegível, a interface direciona aos cadastros financeiros.
Depois, registre a movimentação de saída e concilie essa AP. Portal e gestão
acompanham parcial/quitação/data e reabertura após estorno. A geração repetida
usa a mesma obrigação; o pedido com AP não pode também integrar NF.

Não é criada uma AP para pedidos historicamente pagos. Esses registros permanecem
para conferência e não são reinterpretados como dinheiro comprovado.

## Consulta de caixa

Na lista de movimentações, abra **Consultar relatório de caixa** e selecione o
mês. O corte de data usa São Paulo. Recebimentos/pagamentos entram pela data
da movimentação, independentemente da competência da obrigação e da conciliação.
Estornos são compensações na data do seu registro e não apagam meses anteriores.

O saldo registrado inclui o saldo inicial informado na conta como referência
anterior ao histórico, todas as movimentações até o fim do mês e seus estornos.
Contas inativas continuam consultáveis. Esse saldo não é uma verificação automática
do extrato bancário. O aviso de estorno sem evento confiável significa que o
histórico precisa de revisão; nenhum evento/data é inventado para encobri-lo.

Os totais de obrigações por competência continuam disponíveis em AR/AP.
**Vencidos** soma somente o saldo em aberto, inclusive de títulos parcialmente
liquidados. Vencimento no dia da consulta ainda não é atraso.

## Pendências do roteiro completo

Leitura explícita de baixas legadas das demais obrigações,
correções das origens integradas e anexos financeiros ainda estão em execução.
A validação humana deve aguardar o candidato final e o roteiro integrado completo.
## Baixas históricas e conciliações

As migrations 0054/0055 preservam `received_amount`, `paid_amount`, status e
datas antigos. Capturam separadamente o valor histórico que excede as alocações
ativas em `legacy_settled_amount`; nenhum movimento de caixa é inventado.
Esse saldo é imutável e reserva capacidade do título para impedir pagamento
duplicado. Não é um recebimento/pagamento confirmado nem entra no relatório
de caixa ou no total conciliado.

Financeiro, Cliente e Gráfica consultam alocações de movimentos não estornados.
O saldo aberto desconta essas alocações e a reserva histórica. Telas e exports
identificam a reserva como histórico a conferir. Um estorno remove o efeito
da alocação e preserva a reserva; não apaga movimentos ou documentos.

Antes de migrar uma base existente, revisar as baixas históricas e eventuais
valores acima da obrigação. 0054 exige janela de manutenção, pois bloqueia
temporariamente as quatro tabelas financeiras enquanto captura o legado.
Validar backup/restauração e aplicar primeiro em cópia isolada conforme o
runbook de migrations. Não liberar ou converter reservas por SQL em operação:
um procedimento de revisão auditável do legado ainda é pendência da V1.
