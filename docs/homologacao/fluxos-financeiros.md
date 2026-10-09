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
o procedimento de revisão auditável está disponível no Histórico de AR/AP.

### Revisão conferida da reserva antiga

No Financeiro, abra **Histórico** no título e confira reserva original,
reserva disponível e movimentos conciliados. Anexe documentos pela ligação
de evidências quando necessário. Quem possui `finance.reverse` pode liberar
parte ou toda a reserva indevida, com motivo, referência da evidência conferida
e confirmação explícita. Exemplo: uma baixa duplicada de R$ 40 pode ser revisada
em R$ 10; o original continua R$ 40 e a reserva restante passa a R$ 30.

Isso reabre o saldo da obrigação, sem criar entrada/saída bancária. Pagamentos
reais devem ser registrados como movimentações com evidência e conciliados;
não registre novamente um dinheiro já representado por movimento existente.
Reenvio da mesma revisão não duplica seu efeito. Revisões não podem ser apagadas
ou alteradas; movimentos conciliados depois continuam estornáveis com histórico.

### Cobrança realizada de provisão

Em **Provisões → Ocorrências**, abra **Corrigir cobrança realizada** na ocorrência.
Gestão/Financeiro com permissão de estorno pode corrigir valor e vencimento da AP,
com motivo. A estimativa original, competência, fornecedor e vínculo são mantidos;
não cria outra AP nem caixa. Antes de corrigir um título com liquidação, estorne
as movimentações indevidas ou revise a reserva antiga com evidência. Não use a
edição genérica de contas para contradizer a origem. Cancelar uma previsão ainda
planejada permanece disponível. Para uma ocorrência realizada, abra **Cancelar
cobrança realizada** e informe o motivo. Com finance.write e finance.reverse,
o sistema cancela ocorrência e AP atomicamente, sem excluir o vínculo, valores,
estimativa ou documentos. Qualquer liquidação precisa ser estornada/revisada
antes. A mesma ocorrência cancelada não pode gerar outra AP por reenvio.

### Correção de cobrança efetiva de assinatura

Na assinatura, abra **Cobranças → Corrigir cobrança** na competência desejada.
Informe os dados conferidos da fatura/extrato e o motivo. O sistema mantém a
mesma cobrança, competência e AP, recalcula o principal com a cotação informada
e atualiza o total/vencimento da obrigação na mesma transação. Não altera a
estimativa do contrato nem cria caixa. Exige finance.write e finance.reverse.

Liquidação parcial/integral ou reserva antiga bloqueia a correção até estorno
ou revisão. Se outra pessoa já corrigiu, atualize a página antes de prosseguir.
Os valores anteriores, cotação, responsável e motivo ficam consultáveis no
**Histórico de correções**, além da auditoria completa. O status de pagamento e
o valor conciliado na assinatura usam as mesmas alocações ativas do Financeiro.

### Cancelamento de cobrança de assinatura

Em **Assinatura → Cobranças → Cancelar cobrança**, informe o motivo e confirme
explicitamente. Exige finance.write e finance.reverse. A cobrança e sua AP são
canceladas na mesma transação, com auditoria; valores, vínculo e documentos são
preservados. Uma liquidação parcial/integral ou reserva histórica exige estorno
ou revisão antes. Não cancela o contrato nem gera estorno de caixa por si só.

A cobrança cancelada não é editável ou reaberta. Para corrigir a competência,
cancele a cobrança indevida e registre outra na competência correta. Também é
possível registrar uma substituta na mesma competência: só uma cobrança ativa
é permitida e reenvios não geram outra AP. O histórico mantém a AP cancelada e
a substituta, com estados distintos. Assinaturas com qualquer cobrança, mesmo
cancelada, não podem ser removidas como cadastro incorreto; cancele o contrato
para preservar sua consulta. Cancelar o contrato não cancela automaticamente APs.

### Correção da AP de uma contratação gráfica

No trabalho, abra **Produção e entrega → Corrigir conta a pagar da contratação**.
Gestão/Financeiro com finance.write e finance.reverse pode corrigir valor,
vencimento e competência da mesma AP, com motivo. Confira a fatura/evidência
do fornecedor; a alteração não reescreve a cotação, a contratação, o fornecedor
ou os documentos, nem registra pagamento. A cotação permanece como referência
comercial histórica; o custo financeiro atual é o valor da AP corrigida.

O histórico mostra valores, vencimentos, competências, responsável e motivo.
**Consultar conta a pagar** abre a competência correspondente no Financeiro.
Resumo e dashboard da Gráfica usam essa mesma obrigação. Uma AP cancelada ou
com liquidação/reserva histórica não pode ser corrigida por esse fluxo: estorne
o pagamento indevido ou revise a reserva antes. Se outra pessoa corrigiu,
atualize a página. O encerramento operacional não impede conferir a obrigação.
