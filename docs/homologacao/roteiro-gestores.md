# Roteiro de teste dos gestores — rascunho V1

Executar somente na base fictícia de homologação, após o aceite técnico do
candidato. O preenchimento abaixo não comprova homologação empresarial. Anotar
usuário, horário, ID do trabalho/título/movimento, valor observado e resultado.
Não usar dados pessoais ou documentos reais.

## Dados fictícios para cadastro

| Cadastro | Valores sugeridos |
|---|---|
| Cliente sem fee | Horizonte Homologação; sem cobrança recorrente |
| Cliente com fee | Agência Teste Mensal; fee R$1.000; cobrança dia 15 |
| Fornecedor | Impressão Homologação; contato fictício |
| Conta | Banco Homologação; saldo inicial R$0 |
| Categoria | Produção gráfica; natureza saída |
| Centro de custo | Gráfica Homologação |
| Trabalho | HML-DIRETORIA-001; cliente Horizonte Homologação |
| Cotação escolhida | R$700; prazo e condições descritos no teste |
| Cotação alternativa | R$750; justificativa de rejeição |
| OS externa | PDF fictício; número OS-HML-001; duas versões se houver alteração |
| Venda | R$1.200; sinal R$400 e saldo R$800, com vencimentos distintos |
| Arte final | PDF ou imagem fictícia; versão 1 e versão 2 |

Datas de competência/vencimento e documentos precisam corresponder ao período
escolhido pela diretoria. Usar os valores atuais aceitos pelos formulários.
Os arquivos devem ser documentos válidos sem informações confidenciais. O ERP
registra a OS e a arte; orçamento, emissão fiscal e envio ao fornecedor ocorrem
externamente.

## Sequência operacional

1. Com Gestão, cadastrar os dois clientes e o fornecedor, conta, categoria e
   centro. Conferir que o cliente sem fee não recebe cobrança mensal automática.
2. Criar o trabalho, registrar as duas cotações e a aprovação interna. Conferir
   fornecedor e valores; registrar OS externa. Solicitar alteração do cliente,
   anexar a revisão e registrar aprovação da versão atual.
3. Contratar fornecedor por R$700 e registrar venda parcelada de R$1.200.
   Conferir uma AP e duas AR. Reabrir a tela: não deve criar novas obrigações.
4. Anexar duas versões da arte final. Baixar ambas e conferir os arquivos.
   Avançar produção, criar bloqueio com motivo, resolver/retomar, entregar e
   encerrar. O encerramento não deve quitar AP/AR.

## Sequência financeira e valores esperados

| Operação | Resultado esperado no trabalho/Cliente/Financeiro |
|---|---|
| Entrada R$250; alocar R$200 no sinal e R$50 no saldo | Conciliado R$250; AR abertas R$200 + R$750 |
| Saída R$300; alocar na AP | Pago conciliado R$300; AP aberta R$400 |
| Entrada R$950; alocar R$200 + R$750 nas duas AR | Recebido conciliado R$1.200; AR abertas R$0 |
| Saída R$400; alocar na AP | Pago conciliado R$700; AP aberta R$0 |
| Estornar a entrada de R$950 com motivo | Recebido R$250; AR reabertas R$200 + R$750; alocações originais preservadas |
| Estornar a saída de R$400 com motivo | Pago R$300; AP reaberta R$400 |

Antes de conciliar, o movimento deve aparecer pendente e não quitar obrigação.
Selecionar IDs/descrições deste roteiro, sem vincular outro título por semelhança
de valor. Após cada etapa, consultar o mesmo trabalho, Cliente e Financeiro.
No relatório de caixa, os eventos e compensações devem produzir entrada líquida
R$250 e saída líquida R$300 (variação líquida -R$50) para essas operações. Outras
fixtures da base não podem ser confundidas com o roteiro. Competência dos
títulos e data dos eventos são critérios distintos.

Criar também uma AR manual fictícia de R$100, corrigir para R$80 com motivo e
cancelar antes de receber. Conferir auditoria. Títulos gerados por uma origem
não podem ser alterados livremente no Financeiro; o fluxo de correção na origem
continua em implementação e precisa do roteiro final antes do aceite.

## Acesso, documentos e persistência

Testar Gestão, Gráfica e Financeiro com contas distintas e perfis restritos
configurados; a conta demo de todos os perfis não serve para provar RBAC.
Conferir ações permitidas e negadas, consulta/download de documentos e tentativa
de acesso a ID que não pertence ao usuário/organização. O perfil específico da
Gráfica e os comprovantes financeiros ainda exigem conclusão técnica.

Reiniciar apenas a aplicação e consultar os mesmos IDs/valores/duas versões dos
arquivos. Não repetir seed nem apagar volume/storage. Para importação histórica,
carregar planilha fictícia, revisar vínculos explicitamente e ignorar linhas
inválidas com motivo; não aceitar vínculo sugerido sem conferência.

Registrar falhas como bloqueante, importante ou melhoria, com passo reprodutível
e valor esperado/observado. A diretoria decide o aceite humano após os gates e
a revisão dos riscos do candidato final.
