# Backlog após a homologação

Em 09/10/2026 o integrador pediu encerrar a implementação neste checkpoint,
commitar para a fase de homologação e registrar o restante para a próxima versão.
Não continuar automaticamente a fila original. Este documento preserva suas
pendências; não significa que o escopo V1 completo ou o aceite empresarial foi
concluído. A homologação humana deve usar os fluxos implementados descritos no
[roteiro](roteiro-gestores.md) e nos [fluxos financeiros](fluxos-financeiros.md).

## Ordem da próxima versão

| Prioridade | Trabalho pendente | Evidência / critério de conclusão |
|---|---|---|
| P0 | Tratar problemas bloqueantes encontrados pelos gestores | Reproduzir com IDs, passos e valores; corrigir com teste e auditoria. Falhas de integridade, segurança ou perda de dados impedem ampliar o uso. |
| P1 | Cancelamento financeiro pela origem gráfica | Hoje a correção de AP e venda/parcelas funciona; cancelamento genérico de títulos com origem é bloqueado. Criar operações explícitas para venda/contratação, sem apagar OS, parcelas, compromisso ou documentos; motivo, RBAC, RLS, transação, auditoria e bloqueio de liquidação/reserva. Encerramento operacional deve continuar independente de quitação. |
| P1 | Revisar cancelamento operacional e substituições na Gráfica | Não supor que cancelar um trabalho desfaz uma contratação ou devolve dinheiro. Definir os estados e vínculos de substituição com base no processo aprovado; preservar fontes imutáveis e impedir AP/AR duplicadas. |
| P1 | Correção/cancelamento de NF e reembolso pela origem | Guard do Financeiro impede edição econômica/cancelamento genérico desses títulos. Revisar os writers e completar caminhos pela origem, mantendo exclusividade reembolso avulso/NF, documentos externos e uma só obrigação. Não emitir NF nem inventar vínculos; atualizar migrations de forma expansiva, com testes de rollback e cross-tenant. |
| P1 | Cadastro navegável de projetos/eventos | `graphic_projects` já tem schema/RLS, seleção e validação no trabalho/importação, mas não foi encontrada action/tela de criação. Entregar cadastro com autorização server-side, tenant, Zod, audit e preservação das referências históricas. |
| P1 | Perfis de homologação distintos | Permissões existem; E2E prova Financeiro sem edição operacional e portal sem Financeiro. Preparar usuários Gestão, Gráfica e Financeiro com grants mínimos e provar a matriz de ações/documentos com cada perfil, sem usar a conta de todos os perfis como prova de segregação. |
| P1 | Prova explícita de persistência após reinício | Criar registros e duas versões de documentos; registrar IDs, valores e hashes dos bytes; parar/iniciar somente a aplicação e conferir os mesmos fatos. Não repetir seed, remover volume/container ou limpar storage. |
| P1 | Dados fictícios e roteiro final sem resíduos de QA | Revisar seed isolado para usar movimentos/alocações reais quando demonstrar pagamento. Caches legados não comprovam dinheiro; validar saldo/status de todos os exemplos. Preparar base dedicada nova, sem limpar ou semear sobre dados reais. |
| P1 | Completar a evidência integrada no mesmo trabalho | Já existe E2E de cliente/fornecedores/cotações/OS, venda corrigida parcelada, AP corrigida, arte/produção, conciliação parcial e consulta nos três módulos. Acrescentar estorno nesse mesmo trabalho e prova dos perfis/reinício; múltiplos títulos e estorno já têm testes separados. |
| P1 | Validar competência, obrigações e resultados nos relatórios | Caixa por data efetiva está implementado; DAL/dashboard já possuem indicadores por competência. Revisar clareza dos rótulos, filtros, reservas, provisões realizadas e cancelamentos. Provar meses distintos entre competência/recebimento/estorno, sem duplicar caixa ou considerar reserva antiga como dinheiro confirmado. Reutilizar os cálculos existentes. |
| P1 | Alertas e pendências após correção/estorno/cancelamento | Conferir resolução/reabertura de work items e indicadores no ciclo completo. Não manter pendência encerrada quando há saldo aberto, nem gerar duplicatas por reenvio. |
| P2 | Refinar consulta do histórico de revisões | Revisões da venda guardam snapshots completos antes/depois; a tela mostra total, responsável, motivo e parcelas revisadas. Melhorar a comparação por parcela e o roteiro conforme feedback dos gestores, sem reescrever fatos anteriores. |
| P2 | Preparar ambiente definitivo e entrega | Validar backup/restore, credenciais runtime restritas versus migrator, grants das novas tabelas, storage privado e runbooks na infraestrutura escolhida. R2/produção exigem recursos e autorização próprios. Não promover para main ou implantar produção automaticamente. |

## Limitações deste checkpoint

- Correção da venda mantém a quantidade e os IDs das parcelas; não reparcela,
  troca cliente ou reescreve a OS. Liquidação/reserva exige estorno ou revisão
  antes da correção. Cancelamentos de origem listados acima não estão liberados.
- AR/AP são obrigações. Recebimentos/pagamentos vêm de movimentações e
  conciliações; revisão de reserva histórica não comprova caixa.
- Notas fiscais, orçamentos e OS são emitidos externamente. Arte final é
  documentação privada; não há envio automático ao fornecedor, OCR ou banco.
- A prova explícita de reinício e a matriz completa de perfis ainda devem ser
  concluídas. Não apresentar sua ausência de evidência como teste aprovado.
- RH/férias/admissões/desligamentos, cadastro amplo de produtos/serviços próprios,
  automações bancárias e novas integrações permanecem fora deste recorte.

## Retomada

Abrir nova tarefa/branch conforme `docs/git-workflow.md`, a partir da base de
integração autorizada. Revalidar código/commits e este backlog após o feedback
humano; não executar cegamente o plano histórico. Fazer uma tarefa atômica por
vez, com gates adequados e testes de segurança/migration quando aplicáveis.
Qualquer candidato de release precisa dos seis gates completos no seu SHA e
da revisão das limitações; o teste dos gestores é uma etapa humana separada.
