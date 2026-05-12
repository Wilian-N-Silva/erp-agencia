# PRD | Sistema Interno FG

Versão: 1.0  
Data: 12/05/2026  
Produto: Sistema interno de gestão financeira, pessoas, documentos, NFs, reembolsos, férias, equipamentos, acessos e assinaturas  
Stack alvo: Next.js, React, PostgreSQL Neon Serverless, shadcn/ui  
Prioridade máxima: segurança, rastreabilidade e controle de permissões

## 1. Contexto

A agência precisa substituir controles dispersos em planilhas, WhatsApp, Drive e conversas internas por um sistema único que centralize:

* controle financeiro diário
* clientes e cobranças recorrentes
* colaboradores CLT, PJ, freelancers, sócios e demais vínculos
* composição mensal de pagamento e envio de NF por PJs
* férias, ausências e pausas programadas
* solicitações de reembolso
* documentos sensíveis
* equipamentos e patrimônio
* acessos a plataformas internas e de clientes
* assinaturas, SaaS e licenças
* alertas operacionais e pendências críticas

A versão 1.0 não será um MVP incompleto. Ela deve ser uma primeira versão pronta para uso interno real, com escopo enxuto, mas seguro.

O objetivo não é criar um ERP completo, folha de pagamento, CRM ou sistema robusto de RH. O objetivo é construir uma central operacional segura para a diretoria, financeiro, RH/admin, TI/lideranças e colaboradores.

## 2. Objetivos do produto

### 2.1 Objetivos principais

1. Dar visão diária da saúde financeira da agência.
2. Centralizar clientes, entradas, saídas, provisões e recorrências.
3. Controlar colaboradores, vínculos, custos, férias, documentos e histórico.
4. Permitir que PJs visualizem a composição da NF mensal e façam upload da nota.
5. Permitir solicitação e aprovação de reembolsos.
6. Controlar equipamentos vinculados a colaboradores.
7. Controlar acessos a ferramentas, plataformas e contas de clientes.
8. Controlar assinaturas, SaaS, licenças, custos e renovações.
9. Gerar alertas de pendências críticas.
10. Garantir segurança por autenticação, autorização, logs, auditoria, validação e testes.

### 2.2 Objetivos de negócio

1. Reduzir retrabalho administrativo.
2. Reduzir perda de informações.
3. Reduzir risco em admissões, desligamentos e acessos.
4. Dar previsibilidade financeira para a diretoria.
5. Evitar pagamentos indevidos, NFs incorretas e reembolsos sem controle.
6. Reduzir custos esquecidos com SaaS e licenças.
7. Criar histórico confiável para decisões futuras.

## 3. Não objetivos da versão 1.0

Não construir na versão 1.0:

1. Folha de pagamento calculada pelo sistema.
2. Emissão automática de NF.
3. Pagamento automático.
4. Integração automática com Asaas.
5. Integração automática com contabilidade.
6. Integração automática com Google Workspace.
7. Assinatura eletrônica nativa.
8. Avaliação de desempenho.
9. Recrutamento e banco de talentos.
10. Ponto eletrônico.
11. Timesheet completo por projeto.
12. Banco de horas.
13. Organograma visual.
14. BI avançado.
15. OCR de comprovantes.
16. Armazenamento de senhas.
17. MDM, EDR ou solução própria de cibersegurança.
18. CRM comercial.
19. Gestão de performance de equipe.
20. Chat interno.

A versão 1.0 deve permitir exportações, checklists e registros manuais bem estruturados. Automações profundas só entram quando o processo manual estiver validado.

## 4. Premissas técnicas

### 4.1 Stack

1. Framework: Next.js com App Router.
2. UI: React com shadcn/ui.
3. Banco: PostgreSQL em Neon Serverless.
4. ORM: Prisma ou Drizzle.
5. Autenticação: biblioteca pronta, preferencialmente Auth.js ou equivalente.
6. Autorização: RBAC obrigatório com checagem server-side.
7. Deploy: Vercel ou ambiente equivalente compatível com Next.js.
8. Uploads: storage seguro externo ou Drive corporativo com metadados no Postgres.
9. Logs: tabela própria de auditoria no Postgres.
10. Testes: unitários, integração, E2E e testes de autorização.

### 4.2 Regras de conexão com Neon

1. Usar connection pooling para runtime serverless.
2. Usar conexão direta para migrações, dumps e tarefas administrativas quando necessário.
3. Nunca hardcodar connection string.
4. Usar variáveis de ambiente.
5. Separar ambientes: development, staging e production.
6. Criar branch de banco para testes e staging quando viável.

### 4.3 Princípios de arquitetura

1. Nenhuma autorização deve depender apenas do frontend.
2. Todas as ações sensíveis devem validar permissão no servidor.
3. Toda leitura sensível deve passar por uma camada de acesso a dados.
4. Retornar DTOs mínimos para a interface.
5. Não enviar dados sensíveis ao cliente quando não forem necessários.
6. Não armazenar senhas de ferramentas ou clientes.
7. Todo create, update, delete e export sensível deve gerar log de auditoria.
8. Uploads devem ser validados por tipo, tamanho, extensão e permissão.
9. Soft delete deve ser padrão para registros sensíveis.
10. Hard delete só para administradores técnicos e com log.

## 5. Perfis de usuário e permissões

### 5.1 Perfis

| Perfil | Descrição |
| --- | --- |
| Admin Técnico | Gerencia sistema, usuários, permissões e configurações técnicas. Não deve acessar dados sensíveis por padrão sem permissão explícita. |
| Diretoria | Acesso executivo a financeiro, pessoas, custos, relatórios, alertas e governança. |
| Financeiro | Gerencia entradas, saídas, provisões, reembolsos, NFs, pagamentos e relatórios financeiros. |
| RH/Admin | Gerencia colaboradores, documentos, férias, admissões, desligamentos e dados cadastrais. |
| TI/Governança | Gerencia equipamentos, acessos, SaaS e checklists técnicos. |
| Liderança | Visualiza equipe sob sua responsabilidade, aprova solicitações, acompanha férias, reembolsos e acessos relacionados. |
| Colaborador | Visualiza seus próprios dados, férias/pausas, NFs, reembolsos, equipamentos, documentos e solicitações. |

### 5.2 Matriz de permissão resumida

| Recurso | Admin Técnico | Diretoria | Financeiro | RH/Admin | TI/Governança | Liderança | Colaborador |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard executivo | Configura | Total | Parcial | Parcial | Parcial | Parcial | Não |
| Entradas financeiras | Não por padrão | Total | Total | Não | Não | Não | Não |
| Saídas financeiras | Não por padrão | Total | Total | Não | Não | Não | Não |
| Clientes | Configura | Total | Total | Parcial | Não | Parcial | Não |
| Colaboradores | Configura | Total | Parcial | Total | Parcial | Equipe | Próprio |
| Salário/remuneração | Não por padrão | Total | Total | Total | Não | Não | Próprio |
| Histórico de aumentos | Não por padrão | Total | Total | Total | Não | Não | Próprio resumido |
| Documentos pessoais | Não por padrão | Total | Não por padrão | Total | Não | Não | Próprio |
| Férias | Não por padrão | Total | Parcial | Total | Não | Equipe | Próprio |
| NFs de PJ | Não por padrão | Total | Total | Parcial | Não | Não | Próprio |
| Reembolsos | Não por padrão | Total | Total | Parcial | Não | Aprova equipe | Próprio |
| Equipamentos | Configura | Total | Parcial | Parcial | Total | Equipe | Próprio |
| Acessos | Configura | Total | Parcial | Parcial | Total | Equipe | Próprio |
| SaaS/assinaturas | Configura | Total | Total | Parcial | Total | Parcial | Próprio quando vinculado |
| Logs de auditoria | Total | Total | Parcial | Parcial | Parcial | Não | Não |
| Configurações | Total | Parcial | Não | Não | Parcial | Não | Não |

### 5.3 Regras críticas de autorização

1. Colaborador só pode acessar registros vinculados ao próprio user_id ou employee_id.
2. Liderança só pode acessar colaboradores subordinados diretamente, salvo permissão especial.
3. Financeiro não acessa documentos pessoais sensíveis por padrão.
4. TI/Governança não acessa salário/remuneração por padrão.
5. Admin Técnico não deve ter acesso automático a salários e documentos pessoais, salvo modo especial auditado.
6. Diretoria pode visualizar tudo, mas ações destrutivas devem exigir confirmação e log.
7. Exportações devem exigir permissão específica.
8. Alterações de salário, remuneração, benefícios, NF, pagamento e permissões devem gerar log detalhado.

## 6. Módulos da versão 1.0

## 6.1 Home | Dashboard executivo

### Objetivo

Dar leitura imediata da operação financeira, pendências críticas e eventos próximos.

### Usuários principais

Diretoria, Financeiro, RH/Admin, TI/Governança e Liderança com visão limitada.

### Componentes

1. Card de saldo atual.
2. Card de entradas do mês.
3. Card de saídas do mês.
4. Card de resultado do mês.
5. Card de previsto para próximos 30 dias.
6. Lista de clientes em atraso.
7. Lista de contas a pagar hoje e amanhã.
8. Lista de contas atrasadas.
9. Lista de NFs pendentes de envio.
10. Lista de NFs enviadas aguardando validação.
11. Lista de reembolsos pendentes.
12. Lista de férias próximas.
13. Lista de aniversários da semana.
14. Lista de acessos críticos pendentes de revisão.
15. Lista de equipamentos pendentes de devolução.
16. Lista de assinaturas próximas da renovação.

### Critérios de aceite

1. Usuário sem permissão financeira não visualiza valores financeiros consolidados.
2. Cards financeiros consideram status e competência.
3. Contas vencidas mudam automaticamente para alerta de atraso.
4. NFs pendentes aparecem apenas para perfis autorizados.
5. Alertas podem ser marcados como resolvidos quando a entidade relacionada for regularizada.
6. Dashboard deve carregar sem expor dados sensíveis no payload para usuários sem permissão.

## 6.2 Financeiro

### Objetivo

Controlar entradas, saídas, provisões, recorrências, contas a receber, contas a pagar e resultado.

### Funcionalidades

1. Cadastro de entradas.
2. Cadastro de saídas.
3. Cadastro de provisões.
4. Cadastro de recorrências.
5. Status automático de vencido/atrasado.
6. Filtros por mês, competência, status, categoria, cliente, fornecedor e responsável.
7. Relatório simples de entradas e saídas.
8. Exportação CSV/XLSX com permissão específica.
9. Anexo opcional de comprovantes.
10. Histórico de alterações.

### Entrada financeira

Campos:

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| cliente_id | Sim | Pode ser cliente cadastrado |
| descrição | Sim | Texto curto |
| valor | Sim | Decimal positivo |
| data_vencimento | Sim | Data |
| data_recebimento | Não | Data |
| competência | Sim | Mês/ano |
| status | Sim | previsto, recebido, atrasado, cancelado |
| recorrente | Não | Boolean |
| observação | Não | Texto |
| anexo_id | Não | Comprovante |
| responsável_id | Sim | Usuário interno |

### Saída financeira

Campos:

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| fornecedor | Sim | Texto ou cadastro futuro |
| categoria | Sim | folha, aluguel, tráfego, fornecedor, software, imposto, freelancer, outros |
| subcategoria | Não | Configurável |
| descrição | Sim | Texto curto |
| valor | Sim | Decimal positivo |
| data_vencimento | Sim | Data |
| data_pagamento | Não | Data |
| competência | Sim | Mês/ano |
| status | Sim | previsto, pago, atrasado, cancelado |
| centro_custo | Não | Área, cliente ou projeto |
| recorrente | Não | Boolean |
| observação | Não | Texto |
| anexo_id | Não | Comprovante |
| responsável_id | Sim | Usuário interno |

### Provisões

Categorias iniciais:

1. Folha.
2. Impostos.
3. Pró-labore.
4. Softwares.
5. Freelancers.
6. Benefícios.
7. Reembolsos.
8. Outros.

Campos:

| Campo | Obrigatório |
| --- | --- |
| nome | Sim |
| categoria | Sim |
| valor_estimado_mensal | Sim |
| dia_previsto | Não |
| recorrente | Sim |
| status | Sim |
| observação | Não |

### Critérios de aceite

1. Uma entrada não recebida após vencimento deve aparecer como atrasada.
2. Uma saída não paga após vencimento deve aparecer como atrasada.
3. Provisões entram no cálculo de previsto.
4. Alteração de valor gera log com valor anterior e novo.
5. Exclusão usa soft delete.
6. Exportação gera log.
7. Usuário sem permissão financeira não pode acessar endpoints de valores.

## 6.3 Clientes

### Objetivo

Controlar clientes ativos, pausados, cancelados e suas cobranças recorrentes.

### Campos

| Campo | Obrigatório | Observação |
| --- | --- | --- |
| nome | Sim | Nome do cliente |
| código | Sim | Gerado automaticamente |
| status | Sim | ativo, pausado, cancelado |
| valor_mensal_fee | Sim | Decimal |
| dia_cobranca | Sim | Número 1 a 31 |
| responsável_interno_id | Não | Colaborador responsável |
| forma_cobranca | Não | Pix, boleto, Asaas, transferência |
| observação | Não | Texto |
| data_inicio | Não | Data |
| data_cancelamento | Não | Data |

### Funcionalidades

1. Listagem com status financeiro do mês.
2. Cadastro, edição e cancelamento.
3. Histórico de entradas vinculadas.
4. Geração manual de entrada prevista.
5. Alerta de vencimento.
6. Filtro por status e responsável.

### Critérios de aceite

1. Cliente ativo com fee deve permitir gerar entrada prevista.
2. Cliente cancelado não deve gerar novas entradas recorrentes.
3. Cliente pausado deve aparecer separadamente.
4. Diretoria e financeiro veem valores.
5. Liderança pode ver apenas clientes sob sua responsabilidade, se configurado.

## 6.4 Colaboradores

### Objetivo

Centralizar dados de pessoas, vínculo, matrícula, cargo, área, status, remuneração e histórico.

### Matrícula

Formato padrão: FG-00001  
A matrícula deve ser gerada automaticamente e nunca reutilizada.

Não incluir o vínculo na matrícula, porque o vínculo pode mudar.

### Campos

| Campo | Obrigatório | Sensível |
| --- | --- | --- |
| matrícula | Sim | Não |
| nome_completo | Sim | Não |
| nome_social | Não | Não |
| email_corporativo | Não | Não |
| email_pessoal | Não | Sim |
| telefone | Não | Sim |
| cpf | Não | Sim |
| rg | Não | Sim |
| data_nascimento | Não | Sim |
| endereço | Não | Sim |
| pix | Não | Sim |
| contato_emergencia | Não | Sim |
| cargo_id | Sim | Não |
| área_id | Sim | Não |
| gestor_id | Não | Não |
| vínculo | Sim | Não |
| data_entrada | Sim | Não |
| status | Sim | Não |
| modelo_trabalho | Não | Não |
| localização | Não | Não |
| remuneração_atual | Sim | Sim |
| ajuda_custo_recorrente | Não | Sim |
| transporte_recorrente | Não | Sim |
| observações_internas | Não | Sim |

### Status

1. Ativo.
2. Em férias.
3. Afastado.
4. Em aviso.
5. Desligado.
6. Pausado.
7. Freelancer eventual.

### Vínculos

1. CLT.
2. PJ.
3. Estágio.
4. Freelancer.
5. Sócio.
6. Temporário.
7. Outro.

### Funcionalidades

1. Cadastro e edição.
2. Visualização por área, cargo, gestor, vínculo e status.
3. Cálculo automático de tempo de casa.
4. Histórico de remuneração.
5. Histórico de alterações cadastrais sensíveis.
6. Soft delete ou desligamento, nunca apagar direto.
7. Associação com documentos, equipamentos, acessos, SaaS, férias, NFs e reembolsos.

### Critérios de aceite

1. Matrícula é única.
2. CPF, se informado, deve ser único.
3. Email corporativo, se informado, deve ser único.
4. Alteração de remuneração exige permissão e gera log.
5. Colaborador desligado não pode receber novo acesso ativo sem autorização especial.
6. Colaborador desligado aparece em checklist de offboarding.

## 6.5 Remuneração, benefícios e histórico de aumentos

### Objetivo

Controlar remuneração atual, benefícios, ajuda de custo, transporte, reembolsos e histórico de alterações.

### Regras de nomenclatura

1. Para CLT, a interface pode usar "salário".
2. Para PJ, usar "remuneração contratada", "valor contratado" ou "composição da NF".
3. Para relatórios internos, usar "custo mensal".

### Histórico de remuneração

Campos:

| Campo | Obrigatório |
| --- | --- |
| employee_id | Sim |
| valor_anterior | Sim |
| valor_novo | Sim |
| diferença | Sim |
| data_vigência | Sim |
| motivo | Sim |
| aprovado_por | Sim |
| documento_id | Não |
| created_by | Sim |

### Benefícios

Campos:

| Campo | Obrigatório |
| --- | --- |
| employee_id | Sim |
| tipo_benefício | Sim |
| nome | Sim |
| valor | Sim |
| recorrente | Sim |
| data_início | Sim |
| data_fim | Não |
| status | Sim |
| observação | Não |

### Critérios de aceite

1. Colaborador vê apenas sua remuneração atual e histórico resumido próprio.
2. Diretoria, financeiro e RH/Admin veem histórico completo.
3. TI/Governança não visualiza remuneração.
4. Qualquer alteração gera log.
5. Benefício encerrado não entra em composição futura.

## 6.6 Painel do colaborador

### Objetivo

Dar ao colaborador acesso operacional aos próprios dados, NFs, reembolsos, férias/pausas, documentos, equipamentos e acessos.

### Estrutura

1. Início.
2. Meus dados.
3. Minha remuneração.
4. Minhas NFs.
5. Meus reembolsos.
6. Minhas férias ou pausas.
7. Meus equipamentos.
8. Meus documentos.
9. Meus acessos.

### Card principal para PJ

Título: Você precisa emitir sua NF  
Exibir:

1. Competência.
2. Prazo.
3. Valor total.
4. Composição.
5. Descritivo sugerido.
6. Status.
7. Botão "Enviar nota fiscal".

### Composição da NF

Itens possíveis:

1. Remuneração base.
2. Transporte.
3. Ajuda de custo.
4. Reembolsos aprovados.
5. Outros adicionais.
6. Descontos, se aplicável.

### Exemplo de descritivo sugerido

Prestação de serviços de [função/área] referente à competência de [mês/ano], incluindo remuneração contratada, ajuda de custo, transporte e reembolsos aprovados no período.

### Critérios de aceite

1. Colaborador PJ vê apenas a própria solicitação de NF.
2. Colaborador CLT não deve ver tela de emissão de NF, salvo se houver configuração especial.
3. Upload da NF exige arquivo válido.
4. Valor emitido diferente do valor esperado marca divergência.
5. Financeiro precisa aprovar NF antes de status "aprovada".
6. Upload e reenvio geram histórico.
7. Colaborador não edita a composição da NF.
8. Colaborador pode baixar ou visualizar documentos próprios conforme permissão.

## 6.7 Notas fiscais de PJ

### Objetivo

Gerenciar mensalmente a composição de pagamento e upload de NF dos colaboradores PJ.

### Fluxo

1. Financeiro cria composição mensal por PJ.
2. Sistema gera solicitação de NF.
3. PJ visualiza valor, itens e descritivo.
4. PJ emite NF fora do sistema.
5. PJ faz upload no portal.
6. Sistema valida valor informado.
7. Financeiro confere arquivo, valor e dados.
8. Financeiro aprova, recusa ou solicita ajuste.
9. NF aprovada entra como saída financeira prevista ou conta a pagar.
10. Pagamento é marcado manualmente.

### Entidade invoice_requests

Campos:

| Campo | Obrigatório |
| --- | --- |
| id | Sim |
| employee_id | Sim |
| competência | Sim |
| valor_base | Sim |
| valor_transporte | Não |
| valor_ajuda_custo | Não |
| valor_reembolsos | Não |
| valor_outros | Não |
| valor_descontos | Não |
| valor_total_esperado | Sim |
| descritivo_sugerido | Sim |
| prazo_envio | Sim |
| status | Sim |
| arquivo_nf_id | Não |
| numero_nf | Não |
| data_emissão | Não |
| valor_emitido | Não |
| divergência | Sim |
| observação_colaborador | Não |
| observação_financeiro | Não |
| aprovado_por | Não |
| aprovado_em | Não |
| created_by | Sim |

### Status

1. Rascunho.
2. Aguardando envio.
3. Enviada.
4. Com divergência.
5. Aguardando ajuste.
6. Aprovada.
7. Recusada.
8. Lançada no financeiro.
9. Paga.
10. Cancelada.

### Critérios de aceite

1. Competência não pode duplicar para o mesmo PJ, salvo cancelamento.
2. Valor total esperado é soma dos itens positivos menos descontos.
3. Colaborador só faz upload quando status permitir.
4. Financeiro pode pedir ajuste.
5. Cada upload gera versão.
6. NF aprovada pode gerar saída financeira vinculada.
7. NF paga deve aparecer no histórico do colaborador.
8. Qualquer aprovação, recusa ou alteração de valor gera log.

## 6.8 Reembolsos

### Objetivo

Permitir solicitação, aprovação, conferência e pagamento de reembolsos com histórico.

### Fluxo

1. Colaborador cria solicitação.
2. Informa valor, data, categoria, descrição e anexo opcional.
3. Gestor aprova ou recusa, se aplicável.
4. Financeiro valida.
5. Financeiro aprova para pagamento.
6. Reembolso pode entrar na composição da NF do PJ ou como saída financeira.
7. Financeiro marca como pago.

### Campos

| Campo | Obrigatório |
| --- | --- |
| employee_id | Sim |
| valor | Sim |
| data_despesa | Sim |
| categoria | Sim |
| descrição | Sim |
| centro_custo | Não |
| cliente_id | Não |
| anexo_id | Não |
| status | Sim |
| aprovador_gestor_id | Não |
| aprovado_gestor_em | Não |
| aprovador_financeiro_id | Não |
| aprovado_financeiro_em | Não |
| competência_pagamento | Não |
| entra_na_nf | Sim |
| invoice_request_id | Não |
| saída_financeira_id | Não |

### Categorias iniciais

1. Transporte por aplicativo.
2. Estacionamento.
3. Combustível/deslocamento.
4. Alimentação.
5. Viagem.
6. Hospedagem.
7. Produção/eventos.
8. Materiais.
9. Ferramenta digital pontual.
10. Internet/home office.
11. Outros.

### Status

1. Rascunho.
2. Enviado.
3. Aguardando aprovação.
4. Aprovado pelo gestor.
5. Recusado pelo gestor.
6. Aguardando financeiro.
7. Aprovado para pagamento.
8. Incluído na NF.
9. Pago.
10. Recusado pelo financeiro.
11. Cancelado.

### Critérios de aceite

1. Colaborador vê apenas os próprios reembolsos.
2. Liderança vê reembolsos da própria equipe.
3. Financeiro vê todos.
4. Reembolso aprovado pode ser incluído em NF.
5. Reembolso incluído em NF não pode ser editado sem reabrir a composição.
6. Anexo deve ter controle de permissão.
7. Aprovação e recusa exigem log.

## 6.9 Férias, ausências e pausas programadas

### Objetivo

Controlar férias CLT e períodos combinados de ausência para PJs/freelancers sem misturar conceitos jurídicos.

### Regras de nomenclatura

1. CLT: férias.
2. PJ/freelancer/sócio: pausa programada ou ausência programada.
3. "Férias vendidas" só deve aparecer para CLT.
4. Para PJ, não usar linguagem que simule vínculo CLT.

### Campos para férias CLT

| Campo | Obrigatório |
| --- | --- |
| employee_id | Sim |
| período_aquisitivo_inicio | Sim |
| período_aquisitivo_fim | Sim |
| dias_adquiridos | Sim |
| dias_tirados | Sim |
| dias_vendidos | Sim |
| dias_vencidos | Sim |
| saldo_disponível | Sim |
| próxima_data_vencimento | Sim |
| status | Sim |

### Campos para solicitações de férias/ausência

| Campo | Obrigatório |
| --- | --- |
| employee_id | Sim |
| tipo | Sim |
| data_inicio | Sim |
| data_fim | Sim |
| total_dias | Sim |
| motivo | Não |
| status | Sim |
| aprovado_por | Não |
| documento_id | Não |

### Status

1. Solicitada.
2. Aguardando aprovação.
3. Aprovada.
4. Recusada.
5. Cancelada.
6. Concluída.

### Visão do colaborador

Exibir:

1. Dias disponíveis.
2. Dias tirados.
3. Dias vendidos, se CLT.
4. Férias vencidas, se CLT.
5. Próximo vencimento.
6. Tempo restante para próximas férias.
7. Histórico.
8. Botão de solicitar férias ou pausa programada.

### Critérios de aceite

1. CLT vê férias com saldo.
2. PJ vê pausas programadas.
3. Diretoria e RH/Admin veem todos.
4. Liderança vê equipe.
5. Solicitação aprovada aparece no dashboard.
6. Férias próximas geram alerta.
7. Alterações de saldo exigem permissão e log.

## 6.10 Documentos

### Objetivo

Armazenar metadados e arquivos relacionados a colaboradores, NFs, reembolsos, contratos, equipamentos e desligamentos.

### Tipos iniciais

1. Contrato.
2. Aditivo.
3. Documento pessoal.
4. Termo de responsabilidade.
5. Termo de equipamento.
6. NF.
7. Comprovante de reembolso.
8. Recibo.
9. Documento de férias.
10. Documento de desligamento.
11. Outros.

### Campos

| Campo | Obrigatório |
| --- | --- |
| owner_type | Sim |
| owner_id | Sim |
| tipo | Sim |
| nome_arquivo | Sim |
| storage_key | Sim |
| mime_type | Sim |
| tamanho | Sim |
| sensível | Sim |
| visibilidade | Sim |
| enviado_por | Sim |
| criado_em | Sim |
| versão | Sim |
| status | Sim |

### Regras

1. Arquivo não deve ser público.
2. URL assinada com expiração para download, se usar storage.
3. Se usar Google Drive, registrar link restrito e metadados.
4. Documento sensível exige permissão específica.
5. Upload deve validar extensão e MIME type.
6. Substituição de documento deve criar nova versão.

### Critérios de aceite

1. Colaborador acessa apenas documentos próprios liberados.
2. Documento sensível não aparece para perfil sem permissão.
3. Upload gera log.
4. Download de documento sensível gera log.
5. Exclusão é soft delete.

## 6.11 Equipamentos e patrimônio

### Objetivo

Controlar equipamentos entregues, devolvidos, disponíveis, em manutenção ou descartados.

### Código de patrimônio

Formato padrão: EQ-00001  
O código deve ser gerado automaticamente e nunca reutilizado.

### Campos

| Campo | Obrigatório |
| --- | --- |
| patrimônio | Sim |
| tipo | Sim |
| marca | Não |
| modelo | Não |
| número_série | Não |
| data_compra | Não |
| valor_compra | Não |
| fornecedor | Não |
| nota_fiscal_documento_id | Não |
| garantia_fim | Não |
| estado_conservação | Sim |
| status | Sim |
| colaborador_responsável_id | Não |
| data_entrega | Não |
| data_devolução | Não |
| termo_documento_id | Não |
| localização | Não |
| observação | Não |

### Status

1. Disponível.
2. Em uso.
3. Reservado.
4. Manutenção.
5. Perdido.
6. Danificado.
7. Descartado.
8. Pendente de devolução.

### Critérios de aceite

1. Equipamento em uso deve ter responsável.
2. Colaborador vê equipamentos vinculados a ele.
3. Equipamento vinculado a colaborador desligado gera alerta.
4. Devolução registra data, estado e observação.
5. Alteração de responsável gera log.
6. Patrimônio é único.

## 6.12 Acessos

### Objetivo

Registrar quais plataformas, contas, ferramentas, pastas ou ambientes cada colaborador acessa.

### Regras

1. Não armazenar senhas.
2. Registrar apenas existência do acesso, nível, criticidade, aprovador e status.
3. Acesso de alta criticidade precisa de revisão periódica.
4. Offboarding deve listar acessos a remover.
5. Acesso ativo de colaborador desligado é alerta crítico.

### Campos

| Campo | Obrigatório |
| --- | --- |
| employee_id | Sim |
| sistema | Sim |
| categoria | Sim |
| cliente_id | Não |
| nível_acesso | Sim |
| criticidade | Sim |
| aprovador_id | Não |
| data_concessão | Sim |
| data_revisão | Não |
| status | Sim |
| data_remoção | Não |
| evidência_documento_id | Não |
| observação | Não |

### Categorias

1. Google Workspace.
2. Drive.
3. E-mail/grupos.
4. Meta Business.
5. Google Ads.
6. Google Analytics.
7. CRM.
8. Gestão de projetos.
9. Design.
10. Banco de imagem.
11. Financeiro.
12. Código/repositório.
13. Hospedagem.
14. Cliente.
15. Outro.

### Criticidade

1. Baixa.
2. Média.
3. Alta.
4. Crítica.

### Status

1. Pendente.
2. Ativo.
3. Suspenso.
4. Removido.
5. Em revisão.

### Critérios de aceite

1. Não existe campo de senha.
2. Acesso crítico vencido aparece no dashboard.
3. Colaborador desligado com acesso ativo aparece como alerta crítico.
4. TI/Governança pode atualizar status.
5. Diretoria pode visualizar relatório.
6. Alteração de acesso gera log.

## 6.13 SaaS, assinaturas e licenças

### Objetivo

Controlar ferramentas recorrentes, custos, renovações, usuários vinculados e responsáveis.

### Campos

| Campo | Obrigatório |
| --- | --- |
| nome | Sim |
| fornecedor | Sim |
| categoria | Sim |
| finalidade | Não |
| responsável_interno_id | Sim |
| plano | Não |
| quantidade_licenças_contratadas | Não |
| quantidade_licenças_usadas | Não |
| custo | Sim |
| periodicidade | Sim |
| moeda | Sim |
| data_contratação | Não |
| data_renovação | Não |
| forma_pagamento | Não |
| centro_custo | Não |
| cliente_id | Não |
| documento_contrato_id | Não |
| status | Sim |
| criticidade | Sim |
| observação | Não |

### Status

1. Ativa.
2. Em teste.
3. Suspensa.
4. Cancelada.
5. Em renovação.
6. A cancelar.

### Funcionalidades

1. Cadastro de assinatura.
2. Vínculo de usuários.
3. Alerta de renovação.
4. Alerta de licença sem usuário.
5. Alerta de ferramenta sem responsável.
6. Relatório de custo mensal e anual.
7. Vínculo com saída financeira.
8. Vínculo com acessos.

### Critérios de aceite

1. Assinatura próxima da renovação aparece no dashboard.
2. Licença vinculada a colaborador desligado gera alerta.
3. Custo mensal total é calculado corretamente.
4. Alteração de custo gera log.
5. Usuário sem permissão financeira não vê custo.

## 6.14 Admissão

### Objetivo

Garantir entrada organizada de colaboradores com dados, documentos, acessos e equipamentos.

### Checklist padrão

1. Cadastro criado.
2. Dados obrigatórios preenchidos.
3. Contrato enviado.
4. Contrato assinado ou registrado.
5. Documentos recebidos.
6. E-mail corporativo solicitado/criado.
7. Grupos e acessos definidos.
8. Equipamento preparado.
9. Equipamento entregue.
10. Benefícios configurados.
11. Responsável validou início.
12. Admissão concluída.

### Critérios de aceite

1. Checklist pode ser criado por RH/Admin.
2. Cada item tem status, responsável e prazo.
3. Pendências aparecem no dashboard.
4. Conclusão exige todos os itens obrigatórios resolvidos.
5. Logs registram alteração dos itens.

## 6.15 Desligamento

### Objetivo

Reduzir risco administrativo, financeiro, técnico e operacional em saídas de colaboradores.

### Checklist padrão

1. Data final definida.
2. Motivo registrado.
3. Pendências financeiras revisadas.
4. Reembolsos pendentes revisados.
5. NFs pendentes revisadas, se PJ.
6. Benefícios encerrados.
7. Equipamentos devolvidos.
8. Acessos removidos.
9. Arquivos e responsabilidades transferidos.
10. E-mail suspenso, redirecionado ou tratado.
11. SaaS/licenças revisados.
12. Documentos finais anexados.
13. Desligamento concluído.

### Critérios de aceite

1. Colaborador desligado com acesso ativo gera alerta crítico.
2. Colaborador desligado com equipamento em uso gera alerta.
3. Checklist não conclui sem itens obrigatórios.
4. Alteração de status para desligado dispara pendências.
5. Logs obrigatórios.

## 6.16 Alertas

### Objetivo

Impedir que pendências críticas dependam de memória humana.

### Tipos de alerta

1. Cliente em atraso.
2. Conta vencendo.
3. Conta atrasada.
4. NF PJ aguardando envio.
5. NF enviada aguardando financeiro.
6. NF com divergência.
7. Reembolso pendente.
8. Férias próximas.
9. Férias vencidas.
10. Aniversário da semana.
11. Admissão com pendência.
12. Desligamento com pendência.
13. Equipamento pendente de devolução.
14. Acesso ativo de colaborador desligado.
15. Acesso crítico próximo da revisão.
16. Assinatura próxima da renovação.
17. Licença sem usuário ativo.
18. Documento pendente.
19. Documento vencido, se aplicável.

### Critérios de aceite

1. Alertas devem ser calculados automaticamente.
2. Alertas podem ser filtrados por tipo, prioridade e responsável.
3. Resolver a entidade relacionada resolve o alerta.
4. Alertas críticos devem aparecer no topo.
5. Colaborador vê apenas alertas próprios.

## 7. Modelo de dados sugerido

Esta estrutura é uma sugestão inicial para o Codex implementar com migrations.

### 7.1 Tabelas principais

1. users
2. roles
3. permissions
4. user_roles
5. employees
6. employee_compensation_history
7. benefits
8. clients
9. financial_entries
10. financial_expenses
11. provisions
12. reimbursements
13. invoice_requests
14. invoice_request_items
15. documents
16. equipment
17. access_records
18. saas_subscriptions
19. saas_subscription_users
20. vacation_balances
21. time_off_requests
22. onboarding_checklists
23. offboarding_checklists
24. checklist_items
25. alerts
26. audit_logs
27. categories
28. cost_centers
29. app_settings

### 7.2 Campos comuns

Todas as tabelas sensíveis devem ter:

1. id.
2. created_at.
3. updated_at.
4. deleted_at.
5. created_by.
6. updated_by.
7. tenant_id ou organization_id, mesmo que exista apenas uma organização no início.

### 7.3 Audit logs

Tabela audit_logs:

| Campo | Tipo |
| --- | --- |
| id | uuid |
| actor_user_id | uuid |
| action | string |
| entity_type | string |
| entity_id | uuid |
| before | jsonb |
| after | jsonb |
| ip_address | string |
| user_agent | string |
| created_at | timestamp |

Ações a auditar:

1. Login e logout quando disponível.
2. Criação de usuário.
3. Alteração de perfil/permissão.
4. Criação, edição e exclusão de entrada financeira.
5. Criação, edição e exclusão de saída financeira.
6. Alteração de remuneração.
7. Upload, download e exclusão de documento sensível.
8. Aprovação ou recusa de reembolso.
9. Criação, envio, aprovação, recusa e pagamento de NF.
10. Alteração de status de colaborador.
11. Entrega e devolução de equipamento.
12. Concessão, revisão e remoção de acesso.
13. Exportação de dados.

## 8. Segurança

## 8.1 Autenticação

Requisitos:

1. Usar biblioteca de autenticação pronta.
2. Preferir Google OAuth/OIDC com domínio corporativo.
3. Bloquear acesso a e-mails fora da organização, salvo convite explícito.
4. Sessão segura, httpOnly, secure e sameSite.
5. Expiração de sessão configurada.
6. Proteção contra CSRF quando aplicável.
7. Rate limit em rotas sensíveis.
8. Logs de login e tentativas suspeitas quando viável.

## 8.2 Autorização

Requisitos:

1. RBAC obrigatório.
2. Checagem server-side em todas as queries e mutations.
3. Data Access Layer centralizada.
4. DTOs por perfil.
5. Nunca confiar em permissões vindas do cliente.
6. Testes automatizados para cada perfil.
7. Acesso negado deve retornar erro genérico, sem vazar existência de registro.

## 8.3 Dados sensíveis

Dados sensíveis:

1. CPF.
2. RG.
3. Endereço.
4. PIX.
5. Dados pessoais.
6. Salário/remuneração.
7. Histórico de aumentos.
8. Documentos pessoais.
9. NFs.
10. Reembolsos.
11. Dados financeiros da agência.
12. Acessos e plataformas críticas.

Requisitos:

1. Minimizar exposição.
2. Mascarar quando possível.
3. Logar acesso a documentos sensíveis.
4. Criptografia em trânsito obrigatória.
5. Criptografia em repouso conforme infraestrutura.
6. Backups protegidos.
7. Exportação restrita.

## 8.4 Uploads

Requisitos:

1. Lista permitida de extensões.
2. Validação de MIME type.
3. Limite de tamanho.
4. Nome de arquivo sanitizado.
5. Storage privado.
6. URL assinada e expirada.
7. Bloquear execução de arquivos.
8. Verificação básica de malware se houver ferramenta disponível.
9. Não permitir path traversal.
10. Download autorizado pelo servidor.

Extensões iniciais permitidas:

1. PDF.
2. JPG.
3. JPEG.
4. PNG.
5. XML, para NF quando necessário.
6. XLSX, apenas para importações administrativas se necessário.

## 8.5 Banco de dados

Requisitos:

1. Usar migrations versionadas.
2. Usar constraints de unicidade.
3. Usar foreign keys.
4. Usar decimal para dinheiro.
5. Usar timezone consistente.
6. Usar soft delete.
7. Usar prepared statements via ORM/driver.
8. Considerar Row Level Security para tabelas sensíveis.
9. Separar conexão pooled para runtime e direta para migrations.
10. Backup e restore testados.

## 8.6 LGPD e governança

Requisitos:

1. Coletar apenas dados necessários.
2. Registrar finalidade dos dados sensíveis.
3. Permitir controle de acesso por perfil.
4. Definir retenção de documentos.
5. Evitar exportações desnecessárias.
6. Logar acesso e alteração.
7. Documentar quem pode acessar quais dados.

## 9. Testes obrigatórios

A versão 1.0 não pode ser considerada pronta sem os testes abaixo.

### 9.1 Testes unitários

Cobrir:

1. Cálculo de entradas.
2. Cálculo de saídas.
3. Cálculo de resultado mensal.
4. Cálculo de previsto 30 dias.
5. Cálculo de composição de NF.
6. Cálculo de divergência de NF.
7. Cálculo de reembolsos.
8. Cálculo de férias CLT.
9. Cálculo de status atrasado.
10. Geração de matrícula.
11. Geração de patrimônio.
12. Regras de permissão.

### 9.2 Testes de integração

Cobrir fluxos:

1. Cliente ativo gera entrada prevista.
2. Entrada vencida vira atraso.
3. Saída vencida vira atraso.
4. Reembolso aprovado entra na NF.
5. PJ envia NF e financeiro aprova.
6. NF aprovada gera saída.
7. Colaborador desligado gera alertas de acessos e equipamentos.
8. Assinatura próxima da renovação gera alerta.
9. Upload de documento fica restrito.
10. Alteração salarial gera log.

### 9.3 Testes E2E

Fluxos mínimos:

1. Login como diretoria.
2. Login como financeiro.
3. Login como RH/Admin.
4. Login como TI/Governança.
5. Login como liderança.
6. Login como colaborador PJ.
7. Colaborador PJ visualiza composição e envia NF.
8. Financeiro aprova NF.
9. Colaborador solicita reembolso.
10. Gestor aprova reembolso.
11. Financeiro paga reembolso.
12. RH cadastra férias.
13. TI vincula equipamento.
14. TI remove acesso no desligamento.
15. Usuário sem permissão tenta acessar rota proibida.

### 9.4 Testes de segurança

Cobrir:

1. IDOR.
2. Escalação horizontal de privilégio.
3. Escalação vertical de privilégio.
4. Acesso a documento de outro colaborador.
5. Acesso a financeiro sem permissão.
6. Alteração de salário sem permissão.
7. Upload de arquivo inválido.
8. XSS em campos de observação.
9. SQL injection em filtros e buscas.
10. CSRF em ações mutáveis, se aplicável.
11. Rate limit em login e endpoints sensíveis.
12. Sessão após logout.
13. Exportação sem permissão.
14. Manipulação de employee_id no payload.
15. Manipulação de status financeiro no payload.

### 9.5 Testes de backup

1. Criar backup.
2. Restaurar em ambiente separado.
3. Validar integridade dos registros.
4. Validar documentos vinculados.
5. Validar permissões após restore.

## 10. UX e interface

### 10.1 Princípios

1. Interface limpa e direta.
2. Poucos cliques para ações frequentes.
3. Tabelas com filtros fortes.
4. Cards de alerta no topo.
5. Formulários com validação clara.
6. Diferenciar visualmente status crítico, pendente, aprovado e concluído.
7. Evitar excesso de gráficos.
8. Priorizar leitura operacional.
9. Mobile responsivo, mas desktop é prioridade.
10. shadcn/ui como base visual.

### 10.2 Componentes recomendados shadcn/ui

1. Card.
2. Table.
3. DataTable.
4. Dialog.
5. Sheet.
6. Drawer, se necessário.
7. Form.
8. Input.
9. Select.
10. Calendar.
11. Badge.
12. Alert.
13. Tabs.
14. Dropdown Menu.
15. Button.
16. Toast/Sonner.
17. Tooltip.
18. Command para buscas.
19. Skeleton.
20. Separator.

### 10.3 Estados vazios

Cada módulo deve ter estado vazio com orientação objetiva:

1. "Nenhum cliente cadastrado."
2. "Nenhuma NF pendente."
3. "Nenhum reembolso enviado."
4. "Nenhum equipamento vinculado."
5. "Nenhum acesso ativo."
6. "Nenhuma assinatura cadastrada."

### 10.4 Status visuais

Sugestão de grupos:

1. Verde: recebido, pago, aprovado, ativo.
2. Amarelo: previsto, pendente, em revisão.
3. Vermelho: atrasado, recusado, crítico, divergente.
4. Cinza: cancelado, pausado, removido, encerrado.

Se a implementação não definir cores customizadas, usar variantes do shadcn/ui de forma consistente.

## 11. Rotas sugeridas

### 11.1 Rotas privadas

1. /app
2. /app/dashboard
3. /app/financeiro
4. /app/financeiro/entradas
5. /app/financeiro/saidas
6. /app/financeiro/provisoes
7. /app/clientes
8. /app/colaboradores
9. /app/colaboradores/[id]
10. /app/colaboradores/[id]/remuneracao
11. /app/colaboradores/[id]/ferias
12. /app/colaboradores/[id]/documentos
13. /app/nfs
14. /app/reembolsos
15. /app/equipamentos
16. /app/acessos
17. /app/assinaturas
18. /app/admissoes
19. /app/desligamentos
20. /app/alertas
21. /app/auditoria
22. /app/configuracoes

### 11.2 Rotas do colaborador

1. /portal
2. /portal/dados
3. /portal/remuneracao
4. /portal/nfs
5. /portal/reembolsos
6. /portal/ferias
7. /portal/equipamentos
8. /portal/documentos
9. /portal/acessos

### 11.3 Rotas públicas

1. /login
2. /logout
3. /acesso-negado

## 12. APIs ou server actions sugeridas

Implementar via Server Actions ou Route Handlers, mantendo validação server-side.

### 12.1 Financeiro

1. createFinancialEntry
2. updateFinancialEntry
3. cancelFinancialEntry
4. markFinancialEntryReceived
5. createFinancialExpense
6. updateFinancialExpense
7. cancelFinancialExpense
8. markFinancialExpensePaid
9. createProvision
10. updateProvision
11. exportFinancialReport

### 12.2 Colaboradores

1. createEmployee
2. updateEmployee
3. updateEmployeeCompensation
4. deactivateEmployee
5. startOffboarding
6. createBenefit
7. updateBenefit
8. endBenefit

### 12.3 NFs

1. createInvoiceRequest
2. updateInvoiceRequest
3. publishInvoiceRequestToEmployee
4. uploadInvoiceFile
5. requestInvoiceAdjustment
6. approveInvoice
7. rejectInvoice
8. markInvoiceAsPaid
9. generateExpenseFromInvoice

### 12.4 Reembolsos

1. createReimbursement
2. updateReimbursement
3. submitReimbursement
4. approveReimbursementByManager
5. rejectReimbursementByManager
6. approveReimbursementByFinance
7. rejectReimbursementByFinance
8. includeReimbursementInInvoice
9. markReimbursementPaid

### 12.5 Férias e ausências

1. createVacationBalance
2. updateVacationBalance
3. requestTimeOff
4. approveTimeOff
5. rejectTimeOff
6. cancelTimeOff

### 12.6 Documentos

1. createDocumentUploadUrl
2. confirmDocumentUpload
3. getDocumentDownloadUrl
4. replaceDocument
5. softDeleteDocument

### 12.7 Equipamentos

1. createEquipment
2. updateEquipment
3. assignEquipment
4. returnEquipment
5. markEquipmentMaintenance
6. retireEquipment

### 12.8 Acessos

1. createAccessRecord
2. updateAccessRecord
3. approveAccessRecord
4. markAccessRemoved
5. reviewAccessRecord

### 12.9 SaaS

1. createSaasSubscription
2. updateSaasSubscription
3. linkUserToSaasSubscription
4. unlinkUserFromSaasSubscription
5. markSaasSubscriptionRenewed
6. cancelSaasSubscription

### 12.10 Auditoria e alertas

1. listAuditLogs
2. generateAlerts
3. resolveAlert
4. dismissAlert

## 13. Regras de negócio críticas

### 13.1 Status financeiro automático

1. Entrada prevista com vencimento anterior a hoje e sem recebimento vira atrasada.
2. Saída prevista com vencimento anterior a hoje e sem pagamento vira atrasada.
3. NF aprovada pode gerar saída financeira.
4. Reembolso aprovado pode ser incluído em NF ou saída financeira.
5. Provisões devem compor previsto do mês e próximos 30 dias.

### 13.2 Composição de NF

1. Apenas financeiro cria ou altera composição.
2. Colaborador apenas visualiza e envia NF.
3. Valor total esperado deve ser calculado pelo sistema.
4. Divergência ocorre quando valor emitido é diferente do valor esperado.
5. Reembolso incluído em NF não pode ser pago separadamente sem ajuste.
6. NF aprovada não pode ser alterada sem reabrir fluxo.
7. NF paga não pode ser excluída.

### 13.3 Férias

1. CLT tem saldo de férias.
2. PJ tem pausa programada.
3. Dias vendidos aplicam apenas a CLT.
4. Férias vencidas devem gerar alerta.
5. Férias próximas devem aparecer no dashboard.
6. Alteração manual de saldo exige log e permissão alta.

### 13.4 Equipamentos

1. Equipamento em uso precisa ter colaborador responsável.
2. Equipamento pendente de devolução após desligamento gera alerta.
3. Equipamento descartado não pode ser atribuído.
4. Número de patrimônio é único.

### 13.5 Acessos

1. Acesso ativo de colaborador desligado gera alerta crítico.
2. Acesso crítico precisa de data de revisão.
3. Remover acesso exige status, data e responsável.
4. Senhas não podem ser armazenadas.

### 13.6 SaaS

1. Assinatura ativa com renovação próxima gera alerta.
2. Licença vinculada a colaborador desligado gera alerta.
3. Ferramenta sem responsável gera alerta.
4. Custo não deve ser visível para quem não tem permissão financeira.

## 14. Critérios globais de pronto

A versão 1.0 só está pronta quando:

1. Todos os módulos obrigatórios foram implementados.
2. Todas as rotas privadas exigem autenticação.
3. Todas as ações sensíveis exigem autorização server-side.
4. Testes de permissão cobrem todos os perfis.
5. Logs de auditoria funcionam para ações críticas.
6. Upload seguro está implementado.
7. Dashboard exibe dados corretos por perfil.
8. Painel do colaborador PJ permite visualizar composição e enviar NF.
9. Financeiro consegue aprovar NF e reembolso.
10. RH/Admin consegue controlar férias e documentos.
11. TI/Governança consegue controlar equipamentos, acessos e SaaS.
12. Desligamento gera alertas de acessos e equipamentos.
13. Backup foi testado.
14. Staging foi validado antes de produção.
15. Não existem credenciais hardcoded.
16. Variáveis de ambiente estão documentadas.
17. Migrations rodam do zero.
18. Seed inicial cria perfis, permissões e usuário admin.
19. Build passa sem erro.
20. E2E principal passa.

## 15. Plano de implementação sugerido para Codex

### Etapa 1 | Base técnica

1. Criar projeto Next.js com TypeScript.
2. Configurar shadcn/ui.
3. Configurar lint, formatter e testes.
4. Configurar ORM.
5. Configurar conexão com Neon.
6. Criar estrutura de pastas.
7. Configurar autenticação.
8. Criar RBAC inicial.
9. Criar Data Access Layer.
10. Criar audit logger.

### Etapa 2 | Banco e permissões

1. Criar migrations das tabelas principais.
2. Criar seed de roles e permissions.
3. Criar usuário admin inicial.
4. Criar helpers de autorização.
5. Criar testes de permissão.
6. Criar helpers de soft delete.
7. Criar helpers de auditoria.

### Etapa 3 | Layout e navegação

1. Criar layout privado.
2. Criar sidebar por perfil.
3. Criar header com usuário logado.
4. Criar página de acesso negado.
5. Criar componentes base de tabela, filtros, badges e cards.
6. Criar estrutura do dashboard.

### Etapa 4 | Financeiro e clientes

1. Implementar clientes.
2. Implementar entradas.
3. Implementar saídas.
4. Implementar provisões.
5. Implementar dashboard financeiro.
6. Implementar status automático.
7. Implementar exportação com log.

### Etapa 5 | Colaboradores e remuneração

1. Implementar cadastro de colaboradores.
2. Implementar matrícula automática.
3. Implementar áreas, cargos e gestores.
4. Implementar remuneração atual.
5. Implementar histórico de aumentos.
6. Implementar benefícios.
7. Implementar permissões de visualização.

### Etapa 6 | Painel do colaborador, NFs e reembolsos

1. Criar portal do colaborador.
2. Implementar composição de NF.
3. Implementar upload de NF.
4. Implementar aprovação de NF.
5. Implementar reembolsos.
6. Implementar inclusão de reembolso na NF.
7. Implementar status e alertas.

### Etapa 7 | Férias, documentos, equipamentos, acessos e SaaS

1. Implementar férias CLT.
2. Implementar pausas programadas para PJ.
3. Implementar documentos.
4. Implementar upload seguro.
5. Implementar equipamentos.
6. Implementar acessos.
7. Implementar SaaS/assinaturas.
8. Implementar alertas de governança.

### Etapa 8 | Admissão, desligamento e alertas

1. Implementar checklists.
2. Implementar admissão.
3. Implementar desligamento.
4. Implementar geração automática de pendências.
5. Implementar central de alertas.
6. Implementar resolução de alertas.

### Etapa 9 | Testes e hardening

1. Criar testes unitários.
2. Criar testes de integração.
3. Criar testes E2E.
4. Criar testes de permissão.
5. Criar testes de upload.
6. Criar testes de IDOR.
7. Criar testes de exportação.
8. Validar backup/restore.
9. Corrigir brechas antes de produção.

## 16. Estrutura de pastas sugerida

```txt
src/
  app/
    (auth)/
      login/
      logout/
    (private)/
      app/
      portal/
      acesso-negado/
    api/
  components/
    ui/
    layout/
    dashboard/
    tables/
    forms/
    status/
  features/
    auth/
    rbac/
    audit/
    dashboard/
    finance/
    clients/
    employees/
    compensation/
    invoices/
    reimbursements/
    vacations/
    documents/
    equipment/
    access-control/
    saas/
    onboarding/
    offboarding/
    alerts/
  lib/
    db/
    auth/
    permissions/
    validation/
    storage/
    dates/
    money/
    audit/
  server/
    actions/
    dal/
    services/
  tests/
    unit/
    integration/
    e2e/
  types/
```

## 17. Padrões de código

1. TypeScript estrito.
2. Validar inputs com Zod ou biblioteca equivalente.
3. Usar schemas compartilhados para forms e server actions.
4. Não colocar regra de negócio no componente React.
5. Services para regras de negócio.
6. DAL para queries autorizadas.
7. Actions para mutações autorizadas.
8. Componentes visuais sem acesso direto ao banco.
9. Funções de dinheiro usando decimal, nunca float.
10. Datas centralizadas em helpers.
11. Todos os erros devem ser tratados sem vazar dado sensível.
12. Logs não devem armazenar segredos.
13. Não commitar .env.
14. Criar .env.example.

## 18. Variáveis de ambiente esperadas

```txt
DATABASE_URL=
DATABASE_DIRECT_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ALLOWED_EMAIL_DOMAIN=
APP_URL=
STORAGE_PROVIDER=
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
```

Se usar Drive corporativo em vez de storage S3 compatível, substituir variáveis de storage pelas credenciais seguras do provedor escolhido.

## 19. Seeds obrigatórios

Criar seed com:

1. Organização padrão: Formula Group.
2. Perfis.
3. Permissões.
4. Categorias financeiras.
5. Categorias de reembolso.
6. Tipos de documento.
7. Tipos de equipamento.
8. Tipos de acesso.
9. Categorias de SaaS.
10. Usuário admin inicial via env.

## 20. Métricas de sucesso

### Operacionais

1. 100% dos PJs enviando NF pelo portal.
2. 100% das NFs com composição registrada.
3. 100% dos reembolsos passando pelo sistema.
4. 100% dos equipamentos com patrimônio.
5. 100% dos acessos críticos registrados.
6. 100% dos desligamentos com checklist.
7. Redução de solicitações manuais de NF e reembolso por WhatsApp.

### Segurança

1. Zero rota sensível sem autenticação.
2. Zero ação sensível sem autorização server-side.
3. 100% das alterações críticas com log.
4. 100% dos documentos sensíveis com permissão aplicada.
5. Testes de IDOR passando.
6. Testes de RBAC passando.

### Financeiras

1. Visão mensal de entradas, saídas e resultado.
2. Visão de previsto para próximos 30 dias.
3. Controle de SaaS e assinaturas recorrentes.
4. Controle de reembolsos por competência.
5. Controle de custos de equipe por colaborador e vínculo.

## 21. Decisões fechadas

1. O sistema terá PostgreSQL com Neon Serverless.
2. A interface será React/Next.js com shadcn/ui.
3. O painel do colaborador entra na versão 1.0.
4. O painel do colaborador terá foco operacional em NF, reembolso, férias/pausas, documentos e dados próprios.
5. Matrícula de colaborador entra na 1.0.
6. Patrimônio/matrícula de equipamento entra na 1.0.
7. Segurança é requisito bloqueante.
8. Logs de auditoria são obrigatórios.
9. Permissões por perfil são obrigatórias.
10. O sistema não armazenará senhas.
11. O sistema não emitirá NF automaticamente.
12. O sistema não fará pagamentos automáticos.
13. Integrações externas profundas ficam fora da 1.0.

## 22. Pendências de decisão antes do desenvolvimento

Estas decisões precisam ser preenchidas antes ou durante a primeira etapa técnica:

1. Nome final do sistema.
2. Domínio ou subdomínio interno.
3. Provedor de storage para documentos.
4. Biblioteca de autenticação final.
5. ORM final: Prisma ou Drizzle.
6. Regra exata de domínio permitido para login.
7. Quem será o primeiro usuário admin.
8. Limite de tamanho de upload.
9. Política de retenção de documentos.
10. Lista final de categorias financeiras.
11. Lista final de cargos e áreas.
12. Modelo de descritivo padrão para NF por tipo de PJ.
13. Definição se colaborador CLT acessará portal já na 1.0 ou se apenas PJ terá acesso inicialmente.

## 23. Referências técnicas

1. Next.js Authentication Guide: recomenda biblioteca de autenticação, Data Access Layer e DTOs para controle seguro de autorização.
2. Neon Connection Pooling: recomenda pooled connection string para aplicações serverless e conexão direta para migrations quando necessário.
3. OWASP Web Security Testing Guide: base para testes de autenticação, autorização, sessão, input validation, criptografia, lógica de negócio e client-side.
4. PostgreSQL Row Level Security: considerar para tabelas sensíveis como camada adicional de proteção.

## 24. Instrução final para Codex

Construir primeiro a fundação segura antes de telas avançadas.

Ordem obrigatória:

1. Auth.
2. RBAC.
3. DAL.
4. Audit logs.
5. Banco e migrations.
6. Layout privado.
7. Módulos principais.

Não implementar features fora do escopo sem registrar como backlog.

Não criar automações externas antes dos fluxos manuais estarem seguros.

Não armazenar senhas.

Não expor dados sensíveis no frontend por conveniência.

Não considerar o sistema pronto sem testes de permissão, auditoria, upload e fluxos críticos de NF, reembolso, financeiro, férias, acessos e desligamento.
