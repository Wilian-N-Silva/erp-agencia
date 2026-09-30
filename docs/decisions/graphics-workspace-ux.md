# Planejamento visual — Trabalho da Gráfica

Status: planejamento aprovado; implementação na branch `codex/graphics-workspace`, aguardando integração. Não altera regras de negócio.
Fonte: solicitação de organização por etapas/abas e PRD 03.

## Problema observado

A página atual apresenta todas as seções e formulários numa única coluna.
Cotações aparecem depois de OS, resposta do cliente, financeiro e produção,
embora sejam uma das primeiras atividades. Histórico, ações e preenchimento
competem pela atenção. O operador precisa descobrir a ordem pela própria tela.

## Estrutura proposta

Cabeçalho permanente: código, título, cliente, responsável, prazo, status
operacional e financeiro separados. Editar dados e arquivar ficam no menu
secundário, com confirmação para arquivar.

Faixa de andamento clicável:
Pedido → Cotações → OS → Cliente → Produção → Entrega.
Cada etapa mostra pendente, atual, concluída ou requer atenção. Uma revisão
reabre a etapa pertinente; não apresentar aprovação antiga como válida para
uma OS nova. Financeiro é acompanhamento paralelo, não bloqueio artificial
de toda a sequência operacional.

Abaixo do andamento: uma próxima ação principal, motivo, responsável e botão
que abre a aba relevante. Em espera, destacar com quem está a pendência.

| Aba | Conteúdo | Ação principal contextual |
|---|---|---|
| Visão geral | Resumo, escopo, prazo, pendências e últimos acontecimentos | Continuar etapa atual |
| 1. Pedido | Briefing, especificações, cliente, datas e responsável | Editar pedido |
| 2. Cotações | Comparação de fornecedores, valores, prazos e condições; aprovação interna; recusas preservadas | Nova cotação / Analisar cotação |
| 3. OS | Versão atual em destaque, PDF, número, valor e versões anteriores recolhidas | Registrar OS / Nova versão |
| 4. Cliente | Decisão referente à versão vigente, contato, canal e evidência; histórico separado | Registrar resposta |
| 5. Produção e entrega | Contratação de fornecedor, liberação, andamento, espera, entrega e encerramento | Contratar / Iniciar / Atualizar / Entregar conforme estado |
| Financeiro | Receber, pagar, parcelas, valores conciliados e sugestões de vínculo | Registrar venda / Sugerir conciliação conforme permissão |
| Documentos e histórico | Arquivos agrupados por tipo/versão e timeline de eventos permitidos | Consultar / Baixar |

Contratação aparece operacionalmente em Produção; seus títulos são consultados
no Financeiro sem repetir formulário nem criar segunda fonte de verdade.
Resumo financeiro restrito respeita as permissões atuais.

## Interação

- Ao abrir um trabalho existente, iniciar em Visão geral. O botão Continuar leva
  à ação pendente; URL com `?tab=` permite acesso direto e preserva a aba ao recarregar.
- Abas anteriores continuam consultáveis. Etapas futuras mostram o requisito
  faltante e um link para resolvê-lo; formulários indisponíveis não ficam espalhados.
- Cadastro/edição em painel lateral, com um formulário por vez. Erro mantém os
  valores; sucesso atualiza o resumo e sugere o próximo passo sem forçar navegação.
- Cotações em comparação compacta; detalhes, anexos e motivo de recusa expansíveis.
- OS atual e aprovação atual visíveis antes de versões/decisões antigas.
- Histórico não ocupa o fim de cada seção inteira: mostrar os eventos relevantes
  em resumo e oferecer consulta completa na aba própria.
- No celular, abas com rolagem horizontal, rótulos legíveis e etapa atual destacada.
- Navegação acessível por teclado, foco visível, rótulos de estado além de cor e
  sem perder preenchimento ao trocar de aba sem aviso.

## Sequência de implementação

1. Separar as seções existentes em componentes e introduzir navegação por URL.
2. Reorganizar conteúdo por etapa, sem mudar as regras/ações do servidor.
3. Adicionar andamento, próxima ação e estados de impedimento derivados dos dados.
4. Mover formulários para painéis e consolidar documentos/histórico.
5. Atualizar E2E e manual da Gráfica; validar desktop, celular e permissões.

## Aceite

- Operador identifica etapa, pendência e próxima ação sem percorrer a página inteira.
- Cotação recusada permite procurar outro fornecedor e conserva a recusa.
- Nova versão de OS preserva a anterior e evidencia a aprovação ainda necessária.
- Contratar fornecedor cria AP uma vez; registrar venda/parcelas cria AR sem
  simular recebimento. A reorganização não altera essas invariantes.
- Espera mostra motivo/responsável; retorno, entrega e encerramento ficam claros.
- É possível voltar depois e localizar proposta, OS, aprovação, parcelas e anexos.
- URL de aba, voltar do navegador e recarregar preservam o contexto.
- Autorização permanece no servidor; não revelar custos ou histórico restrito
  em contadores, resumos ou abas ocultas.

Fora de escopo: nova apresentação separada, limpeza da base, geração de OS pelo
ERP e mudanças nas aprovações ou na conciliação financeira.
