# Progresso e evidências

## 09/10/2026 — HML-01 em andamento

Baseline `f3762ec`; árvore limpa; main/development sincronizadas. Migrations
0000..0050. Últimos commits: arte final, cobrança efetiva SaaS, fixtures PJ e ciclos.
Worktrees preexistentes SEC-002 e invoice-download-validation e stash de mockup
preservados. Banco local existente e servidor localhost:3000 não serão usados para
testes destrutivos. Nenhum deployment ou alteração de dados nesta auditoria.

Lidos AGENTS, índice, PRDs Core/Financeiro/Gráfica, execução, segurança, testes,
migrations, workflow e runbooks de entrega/ambiente/validação financeira.
Runbooks históricos contêm lacunas já corrigidas por commits mais recentes;
matriz distingue essas evidências de itens realmente ausentes.

Achados confirmados: baixa direta em três ações ainda ativas; leituras financeiras
aceitam cache/status histórico; estorno não implementado; alocações protegidas por
trigger imutável (0023). Relatório de atrasados soma valor original em vez do saldo.
Reconhecimento continua em comprovantes, projetos, permissões e todas as origens.
Próximo: ambiente descartável independente e gates baseline antes do cutover.

## HML-01 — baseline isolado / HML-02 — primeira proteção

Criado container PostgreSQL exclusivo da homologação em loopback:15433, diferente
de `erp-agencia-postgres`. Banco novo `erp_hml_dbtests`, migrator BYPASSRLS e app
NOBYPASSRLS/não owner. Nenhum banco preexistente removido; migrations 0000..0050
aplicadas com sucesso. Credenciais ficam somente em arquivo `.env.*` ignorado.
Baseline: lint verde, 430 unitários, 211 integração/segurança/migration em 34 arquivos
com `npm run test:db -- --fileParallelism=false` (55,33 s).

Baixas diretas de AR/AP/Clientes rejeitam chamadas no servidor após autenticação,
permissão, rate limit e validação, sem ler/escrever títulos. Botões agora abrem
movimentações/conciliação. Três regressões testam rejeição inclusive com autorização
e limite disponível. Nenhum dado histórico modificado. 433 unitários e lint verdes.
Logs locais: `storage-local/homologacao/baseline-*` e `cutover-*`.

Esta proteção não conclui FIN-010: ainda faltam fontes de leitura legadas explícitas,
guards de edição/cancelamento e demais origens. Build/E2E desta candidata ainda
pendentes; testes históricos não serão apresentados como aprovação desta V1.

## HML-03 — estorno em validação

Registro de estorno por movimentação, motivo obrigatório, permissão `finance.reverse`,
histórico imutável e recálculo transacional dos títulos. Reenvio concorrente devolve
o mesmo estorno. Alocações originais permanecem; somente movimentações ativas
participam das somas. UI no detalhe da movimentação e audit de motivo/antes/depois.
Correção de dinheiro lançado por engano: estornar e cadastrar movimento correto;
nenhuma transferência bancária automática.

0051 foi gerada por drizzle-kit para tabela/RLS/grant/trigger imutável e guard de
títulos. Teste revelou que o trigger de capacidade antigo contava alocações
estornadas. Como 0051 já estava aplicada no banco isolado, gerada migration custom
0052 para corrigir o guard sem editar histórico. Ambas aplicadas somente em testes.

215 testes de banco em 35 arquivos passaram (69,08 s), incluindo concorrência,
AR/AP, nova conciliação após estorno, isolamento/RLS, payload, permissão e rollback.
Unitários, lint e typecheck passaram antes do último E2E adicionado; próxima etapa
revalida os gates e build/E2E no checkout separado `erp-agencia-hml-validation`.
Esse checkout tem banco E2E novo `erp_hml_e2e`, seed apenas fictício e uploads próprios.
Não é o ambiente local em uso nem a candidata empresarial aprovada.

### Evidência do checkpoint `abce9c0`

436 unitários (67 arquivos), 215 de banco (35 arquivos), typecheck e lint verdes.
Build aprovado na worktree isolada, migrations 0051/0052 e seed somente em
`erp_hml_e2e`. `finance-reversal.spec.ts`: 1/1 aprovado, processo exit 0, registra
cliente/AR, concilia R$100, estorna com motivo, preserva vínculos e confere AR
reaberta com recebido R$0 no Cliente após reload. Logs: `build-reversal.log` e
`reversal-e2e.log` na worktree; demais logs em storage-local/homologacao.

Pendente: gate E2E completo preparado sem dependências de QA histórico; cobertura
Gráfica→Financeiro→Cliente, relatórios de caixa com estorno por data, legado explícito,
guards de edição/cancelamento, documentos financeiros, projeto/perfis e restart.
O SHA acima é um checkpoint de desenvolvimento, não o candidato final homologável.

## HML-02 — proteção de correções e cancelamentos

Edição e cancelamento agora bloqueiam o título com `FOR UPDATE` dentro da
transação tenant existente. Justificativa obrigatória é validada com Zod estrito
e gravada junto do before/after na auditoria. Não se permite reduzir o valor
abaixo da liquidação, trocar contraparte liquidada, alterar título cancelado ou
cancelar uma obrigação com baixa parcial/integral, inclusive histórica.

Origens explícitas (parcela gráfica, contratação, NF, cobrança SaaS e ciclo de
provisão) protegem valor, contraparte, competência, recorrência e cancelamento.
Informações documentais e vencimento continuam corrigíveis. Não são inferidos
vínculos por descrição. A interface pede motivo e apresenta os conflitos seguros
sem expor erros internos. Correções revalidam também Cliente, Gráfica e Portal.

444 unitários/68 arquivos e 220 testes de banco/36 arquivos aprovados. Typecheck
e lint aprovados (warning de import removido). Novos testes verificam proteção
histórica, origens, justificativa, payload, permissão, auditoria e rollback.
Logs em `storage-local/homologacao/title-*.log`, somente banco isolado.
Sem migration/backfill neste incremento. Build/E2E da interface em validação.

Pendente antes de considerar esta proteção completa para V1: revisão controlada
das origens integradas quando for necessário desfazer uma contratação/venda,
explicitação do legado nas leituras e tratamento da baixa direta de reembolso
avulso identificada em `portal/actions.ts`. Não declarar candidato pronto.

### Validação da interface de correção

Build do código `09f05e5` aprovado na worktree isolada. Em `8d83860`, dois E2E
passaram no mesmo build: correção/cancelamento com justificativa e
recebimento/conciliação/estorno/consulta no Cliente. Logs:
`build-title-corrections.log`, `title-and-reversal-e2e.log` nessa worktree.
As primeiras execuções do novo E2E falharam por seletor relativo do MoneyInput e
por esperar mensagem em um formulário removido após cancelar. Corrigidos os
testes, sem relaxar proteção ou modificar a regra de negócio.

## HML-04 — saldo vencido parcial

O dashboard de competência somava o valor original apenas quando o estado
derivado era `overdue`; uma obrigação parcial já vencida ficava fora do total.
Agora o indicador usa a data de vencimento e soma somente o saldo em aberto,
excluindo cancelados e liquidados. Vencimento no próprio dia ainda não é atraso.
Dois testes cobrem AR/AP parcial, estados, competência e reabertura após estorno.
446 unitários/69 arquivos aprovados; sem migration, backfill ou alteração de caixa.
Caixa por eventos datados, legado explícito e relatórios completos continuam pendentes.

## HML-04 — caixa por eventos

Relatório em `/app/financeiro/relatorios`, acessível pela lista de movimentações.
Cada conta mostra saldo anterior, entradas, saídas, estornos de cada direção,
resultado do mês e saldo registrado. Uma query tenant/RLS agrega valores numeric
sem float e sem usar AP, AR, provisões ou alocações como dinheiro. Movimentações
pendentes de conciliação participam; conciliar múltiplos títulos não duplica caixa.

O evento original permanece no seu mês. Estorno compensa somente na sua data,
com corte de mês em `America/Sao_Paulo`. Saldo inicial informado na conta é a
referência anterior às movimentações; o relatório não afirma equivalência a
extrato bancário. Estorno legado sem evento confiável sinaliza saldo não validado,
sem inventar data de estorno. Contas inativas continuam presentes no histórico.

Teste de banco comprovou passagem de mês, horário próximo da meia-noite UTC,
saldo inicial, compensação posterior sem reescrever setembro, RLS/organização,
permissão, payload e aviso de legado inconsistente. Sem migration/backfill.
Revisão do legado das obrigações, demais relatórios e E2E completo seguem pendentes.

### Evidência do checkpoint `c773ccc`

Typecheck, lint e 446 unitários aprovados; suíte serial isolada de banco com
221 testes/36 arquivos aprovada. A asserção adicional do estorno de saída passou
também na repetição focal de 5 testes de `finance-reversals.test.ts`.
Logs `cash-*.log` em `storage-local/homologacao`.

Build aprovado na worktree isolada (`build-cash-report.log`). Dois E2E passaram
(`cash-and-correction-e2e.log`): correção/cancelamento com motivo e
Cliente→movimentação→conciliação→estorno→Cliente→relatório. O relatório aumentou
o estorno de entrada em exatamente R$100 e manteve o valor após reload.
Não foi executado o gate E2E completo neste checkpoint. Este SHA não é o
candidato final. Sem alteração em bancos existentes/main/development.

## HML-02 — reembolso avulso com origem única

Substituída a baixa direta por geração explícita de AP para reembolso aprovado.
Gestor financeiro informa competência, vencimento, categoria e centro de custo;
valor e favorecido vêm do pedido/colaborador autorizado, sem inventar fornecedor.
O reembolso tem FK tenant/índice único para AP. Linha é bloqueada na transação:
gerações concorrentes devolvem a mesma AP e auditoria acompanha ambos os lados.
Pedido com AP não pode entrar em NF; pedido vinculado à NF não pode gerar AP.

O endpoint legado `markReimbursementPaidAction` não grava pagamento, mesmo para
pedido avulso aprovado. A interface abre a geração da obrigação ou encaminha à
conciliação. Portal/gestão derivam parcial/quitação/data das alocações de saída
ativas e reabrem o estado após estorno, sem segunda gravação de pagamento.
Pagamentos históricos sem AP permanecem preservados e identificados para revisão.

Migration 0053 gerada por drizzle-kit: coluna nullable, FK tenant, unicidade,
exclusão de dupla origem e trigger que preserva vínculo/valor/favorecido após AP.
Sem backfill, sem novas obrigações para o histórico e sem alteração em migration
anterior. Aplicada apenas ao banco isolado de testes. Teste de upgrade real
0050→0053 em schema novo comprovou preservação, ausência de AP inventada e guards.

450 unitários/70 arquivos e 226 DB/38 arquivos aprovados; typecheck/lint verdes.
Testes novos: concorrência, parcial/integral/estorno, own-scope, organização,
permissões, payload, rollback de auditoria, dupla origem e recusa da baixa direta.
Logs `reimbursement-*.log` e `hml-upgrade.log` em storage-local/homologacao.
Build/E2E do novo fluxo ainda em validação. Legado das demais obrigações segue
pendente; não considerar a candidata pronta.

### Evidência final do incremento de reembolso

Checkpoint runtime `f21468d`, E2E final em `c9bf573` (apenas ajuste do teste).
Typecheck/lint e 450 unitários aprovados. Suíte serial isolada: 227 testes de
banco/38 arquivos; repetição focal dos cinco testes de reembolso também verde
após acrescentar a proteção de `paidAt` histórico. Upgrade 0050→0053 aprovado.
0053 aplicada somente nos dois bancos isolados. Nenhum backfill foi realizado.

Build aprovado (`build-reimbursement.log`). `portal-invoice-workflow.spec.ts`
passou com exit 0 em 41,2 s (`reimbursement-e2e.log`): comprovante PDF no portal,
aprovação do gestor/Financeiro, criação de categoria pela UI, geração de AP,
conciliações de R$10 e R$15, quitação consultada no portal, estorno dos R$15 e
retorno a pagamento parcial. Perfis RH e diretoria consultaram suas rotinas.
O teste focal não substitui o gate E2E completo nem o aceite humano.

Durante a validação foram corrigidos o nome acessível dos selects e a orientação
quando não há categoria financeira; o teste passou a cadastrar sua categoria e
abrir o painel de novo cadastro. Sem enfraquecer RBAC/rate limit. Obrigações
aprovadas de colaborador arquivado continuam geráveis e pagamentos históricos
não podem ganhar uma nova AP por engano. Manuais de gestão/portal atualizados.
Próxima etapa: explicitar saldo legado e usar alocações/eventos nas leituras de
AR/AP, Cliente, Gráfica e alertas; sem apagar histórico nem inventar caixa.
### FIN-010 — leitura canônica e reserva histórica

Incremento na branch `feature/homologacao-v1-grafica-financeiro`: AR/AP,
Cliente, alertas, conciliação e resumo da Gráfica passaram a consultar
alocações ativas. Cache não comprova pagamento. Dashboard/CSV/XLSX distinguem
conciliado, reserva histórica e saldo aberto. Cliente inclui o saldo restante
de títulos parcialmente recebidos que já venceram.

0054 captura o legado sem fabricar movimentos nem alterar caches históricos;
0055 amplia o trigger de imutabilidade para a nova coluna. Ambas foram
geradas com drizzle-kit e aplicadas somente em `erp_hml_dbtests`. A segunda
migration corrige uma lacuna detectada pelo novo teste de proteção, sem editar
a migration já aplicada. Upgrade real 0050→0055 preserva histórico, captura
AR parcialmente alocada e AP antiga quitada, sem criar caixa artificial.

Typecheck/lint, 451 unitários e 228 testes DB/38 arquivos aprovados
(`ledger-*.log`). Build e E2E do incremento seguem em validação. Testes novos verificam cache
obsoleto, reserva imutável, capacidade, AR/AP parcial/estorno e isolamento.
O procedimento auditável para revisão/liberação de reservas históricas e as
correções nas origens continuam pendentes; não há candidata final aprovada.
### Evidência do incremento de ledger e preparação E2E

Commit `4725051`: build aprovado em worktree isolada; 0054/0055 aplicadas também
em `erp_hml_e2e`, sem tocar a base local usual. Quatro E2E focais passaram em
43,2 s: cliente recorrente→AR→conciliação, recebimento de múltiplos títulos e
saldo parcial, estorno com reabertura, correção/cancelamento motivado. Logs
`build-ledger.log` e `ledger-e2e.log` na worktree de validação.

Em preparação para o gate completo, testes de arte final e abas passam a criar
seu próprio trabalho pela UI. Teste de download de NF cria documento fictício
próprio em vez de depender de uma execução anterior. Fixtures SQL só aceitam
base local explicitamente nomeada `erp_hml_e2e` e runtime correspondente;
teste unitário cobre recusa da base usual/remota/divergente. Contas necessárias
são cadastradas pela UI e a consulta SaaS usa busca para não depender da
primeira página. Validação focal dessas mudanças ainda em execução.
### Gate E2E completo — falhas de pré-condições, ainda não aprovado

Runtime `4725051`, testes `419178c`: comando `npm run test:e2e -- --workers=1`
via processo com `.env` isolado. Cinco cenários falharam: importação/provisão
dependiam do fornecedor QA ausente; OS dependia de código duplicado preexistente;
consulta financeira reutilizava contexto após sign-out e recebeu 403; fixture
NF exigia STORAGE_PROVIDER apesar de o backend real ser selecionado por
credenciais R2. Asserções não foram removidas. Fixtures corrigidas para criar
fornecedor/trabalho próprio, separar contextos e usar getStorageConfig.
Log completo em `homologacao-full-e2e.log` na worktree isolada.

Fluxos financeiros focais, arte versionada, portal/AP, NF/AP e SaaS passaram
nessa execução. O gate completo permanece vermelho até repetição aprovada;
não há candidato pronto. Ambiente e roteiro fictício dos gestores documentados
como preparação/rascunho, com as pendências técnicas explícitas.
### Repetição dos cenários afetados

Testes `83401ab`, runtime `4725051`: seis cenários em 2,7 min, cinco aprovados.
Importação histórica com revisão/conciliação, abas/mobile, consulta Financeiro
sem edição operacional, download de NF e provisões passaram. OS ainda dependia
do segundo fornecedor QA ausente; corrigido em `87d8794`, junto à seleção da
aba atual de edição. Repetição do cenário de OS em execução. Logs
`fixtures-recheck-e2e.log` e `graphics-ledger-e2e.log` na worktree isolada.

Gates confirmados neste checkpoint: typecheck/lint; 452 unitários/71 arquivos;
228 DB/38 arquivos (runtime `4725051`); build do mesmo runtime. Gate E2E
completo anterior teve 16/21 aprovados e segue sem aprovação final. Próximos
incrementos incluem comprovantes financeiros, correções de origens/revisão
legada, relatórios restantes e perfis/referências antes do candidato final.
### Gate completo aprovado neste checkpoint

Runtime `4725051`, testes `5df0553`: **21/21 E2E aprovados**, exit 0, 5,2 min,
com `npm run test:e2e -- --workers=1` em `erp_hml_e2e`. Evidência:
`homologacao-full-e2e-recheck.log`. As cinco falhas anteriores foram corrigidas
nas pré-condições dos testes, sem enfraquecer segurança ou retirar asserções.
`87d8794` também passou no teste focal de OS em 11,3 s.

`f8ca269` amplia o cenário de Gráfica com cliente sem fee próprio, duas versões
de arte no mesmo trabalho, pagamento de AP em R$300 + R$900 e conferência das
AR no Cliente. Typecheck/lint aprovados; E2E focal desse incremento em validação.
O resultado verde do checkpoint anterior não cobre automaticamente esse teste
ampliado nem encerra o backlog V1. Prova de restart, documentos financeiros,
perfis/referências e correções/revisão histórica ainda precisam ser concluídos.
### Cenário integrado ampliado aprovado

Testes `f8ca269`, runtime `4725051`: OS E2E ampliado aprovado, exit 0, 13,0 s
(`graphics-integrated-e2e.log`). Cliente sem fee cadastrado pela UI, fornecedor
e alternativa próprios, duas artes no mesmo trabalho, AP paga em R$300 + R$900,
e AR de R$500/R$1.450 consultadas no Cliente com os mesmos valores conciliados.
Histórico, bloqueio/retomada, entrega/encerramento e rejeições continuam cobertos.
Nenhuma migration aplicada fora dos bancos isolados; worktrees/stash anteriores
preservados. Branch enviada ao GitHub; sem merge main/development ou deploy.

Próxima task viável: FIN-008, anexos/comprovantes em AR/AP/movimentação usando
storage/documentos existentes, validação de dono/organização, versionamento,
download autorizado e auditoria. A V1 não está pronta enquanto esse fluxo e
os demais bloqueios listados na matriz não forem resolvidos e revalidados.
### FIN-008 — anexos financeiros em validação

AR/AP e movimentações ganharam acesso a documentos vinculados, com PDF/PNG/JPG,
assinatura/limite/checksum, storage privado e versões por tipo. Upload exige
finance.write e limite persistido de upload; leitura/download exige permissão
financeira e dono da mesma organização. Permissão de documentos genéricos não
concede acesso financeiro. Exclusão pela ação genérica bloqueada; versões
anteriores preservadas. Upload não altera saldos nem cria conciliações.

Sem nova tabela/migration: reutiliza files/documents com RLS existente.
Transação trava o dono para serializar versões e reverte metadados/auditoria,
com compensação do objeto armazenado se a transação falhar. 453 unitários e
231 DB/39 arquivos passaram; typecheck/lint verdes. Logs attachments-*.log em
storage-local/homologacao. Build/E2E focal e revisão final ainda em execução;
não considerar FIN-008 aceito nem a candidata final pronta neste checkpoint.
### Evidência do upload financeiro

`673a779`: build verde (`build-attachments.log`) e E2E focal verde em 5,5 s
(`attachments-e2e.log`) na worktree isolada: AR com duas versões, download com
bytes exatos/cache privado, portal recebe 404, Financeiro consulta e movimento
recebe documento persistido. Integração DB cobre também AP, concorrência de
versões, tenant/RLS, payload e rollback/compensação. Não altera caixa/alocações.

Teste da Server Action passou a usar ambiente Node para File.arrayBuffer (a
ação roda no servidor); a primeira execução desse teste falhou no File do jsdom.
Proteções reais preservadas. Adicionada recusa de tenant ausente antes do rate
limit. Validação unitária/typecheck/lint desse complemento em execução. Manual
de gestão atualizado. Sem migrations/backfills novos neste incremento.
### FIN-008 — incremento validado

Runtime `4c5d86f`, teste ampliado `ee1afcf`: build aprovado
(`build-attachments-final.log`) e E2E focal aprovado (`attachments-final-e2e.log`).
O cenário cobre AR com duas versões, documento em movimentação, AP cadastrada
com fornecedor/categoria pela UI, downloads com bytes corretos, consulta
Financeiro e recusa 404 para o portal. 456 unitários/73 arquivos e typecheck/lint
aprovados. 231 testes DB/39 arquivos aprovados no incremento `673a779`; a mudança
posterior acrescenta recusa antecipada de tenant ausente e seus testes unitários.

Nenhuma nova migration/backfill. Segurança revisada: autenticação, finance.write
no upload, permissões financeiras na leitura, organização/dono no DAL e RLS
existente, Zod strict/anti-tampering, rate limit persistido antes do upload,
auditoria, transação e compensação de storage. Versões preservadas e nomes de
arquivo com controles/path rejeitados. UI tem labels, estado pendente e retorno
acessível; componentes servidor consultam acesso antes de renderizar.

Este resultado não substitui o gate completo no SHA final, prova de restart ou
conclusão das correções de origens/revisão legada e relatórios/perfis/referências.
O Goal segue ativo e sem candidato final aprovado. Próxima prioridade P0:
procedimento seguro e auditável para correções financeiras das origens/legado,
sem alterar fatos imutáveis nem permitir duplicação de pagamentos.

### CORE/GRF — identidade e consulta dos vínculos financeiros

A revisão das correções de origem encontrou dois caminhos inseguros: edição
livre do cliente após OS/venda/contratação e arquivamento de trabalho com títulos
vinculados. Corrigidos nas ações de servidor e na migration aditiva 0056, sem
alterar registros antigos. O lock do trabalho é compartilhado com os registros
de OS/venda/contratação; referências passam por validação de tenant antes da
verificação. Encerramento operacional continua permitido e não quita títulos.

O arquivamento recusado retorna conflito visível na interface. Não há tabela,
permissão, backfill ou mudança em valores financeiros. Mantidos RBAC/RLS,
rate limit, transação e auditoria; recusas não escrevem dados. Proteção no banco
também recusa escrita direta, e outro tenant não consegue alterar o trabalho.

Typecheck/lint aprovados; 458 unitários/73 arquivos e 232 DB/39 arquivos
aprovados (`job-integrity-*-final.log`, `job-integrity-db.log`). A primeira suíte
unitária revelou fixtures sem clientId; corrigidas e ampliadas com dois testes
de recusa. Upgrade isolado 0050→0056 aprovado. Migration aplicada somente no
banco isolado. Build/E2E focal ainda pendentes neste registro; não é gate final.
Essa correção é necessária à integridade integrada, mas não conclui o fluxo de
correção econômica de venda/contratação, que permanece P0 no backlog.

Build de `62a2eec` aprovado (`build-job-integrity.log`). E2E integrado aprovado
com runtime `62a2eec` e teste `6f07658` (`job-integrity-e2e-final.log`): trabalho,
duas artes, AR parcelada, AP, pagamentos/recebimentos parciais, consulta Cliente,
encerramento e arquivamento recusado com mensagem visível/valores preservados.
A primeira execução falhou por seletor ambíguo entre alerta da aplicação e
anunciador de rota do Next; seletor especificado, sem remover a verificação.

### FIN-010/006 — revisão explícita da reserva histórica

Acrescentado registro imutável de liberação conferida da reserva, preservando
o baseline original. O saldo efetivo usa baseline menos liberações, somado às
alocações ativas. Financeiro, Cliente, Gráfica, alertas, conciliação e estorno
consultam esse saldo. Não cria caixa nem declara comprovada uma baixa antiga.
Interface de Histórico em AR/AP mostra original, restante, confirmado e revisões;
liberação exige finance.reverse, motivo, evidência e confirmação explícita.

Migrations expansivas 0057/0058 geradas pelo drizzle-kit: tabela tenant/FKs/RLS,
imutabilidade, limite concorrente e atualização dos guards de saldo. A primeira
suíte identificou a matriz RLS ainda sem a tabela nova e o trigger executando
antes da checagem RLS de INSERT. Matriz atualizada e nova 0058 recusa tenant
antes da consulta do dono, sem editar 0057 já aplicada no ambiente isolado.
Segunda suíte DB: 236 testes/40 arquivos aprovados (`legacy-review-db-final.log`),
incluindo upgrade 0050→0058, AR/AP, liberação idempotente, conciliação posterior,
estorno, RLS, anti-tampering, concorrência e rollback de auditoria. UI/build e
gates após os últimos ajustes ainda em execução. Nenhuma migration de produção.

Correções econômicas das origens permanecem P0. Esta entrega libera uma reserva
indevida explicitamente conferida; não transforma automaticamente baixas
históricas em movimentos e não fornece autorização para revisar sem evidência.

Runtime `d895330`, teste `cd00f93`: build e E2E de revisão aprovados
(`build-legacy-review.log`, `legacy-review-e2e-final.log`). E2E integrado Gráfica
também aprovado no runtime novo (`legacy-review-e2e.log`). A primeira asserção
do portal esperava acesso-negado, mas o layout existente o redireciona ao portal;
teste ajustado para essa fronteira real e confirma ausência dos dados/formulário.
Typecheck/lint e 462 unitários/75 arquivos verdes; repetição DB no commit aprovada
com 236 testes/40 arquivos (`legacy-review-db-commit.log`). E2E completo ainda
em execução; não há declaração de aprovação dos gates finais do candidato.

### FIN-006 — correção de cobrança realizada de provisão

Corrigido o encaminhamento sem saída entre ocorrência e Financeiro: a ocorrência
realizada agora permite corrigir valor/vencimento da sua AP, com finance.write
e finance.reverse, motivo obrigatório e rate limit de conciliação. Preserva a
estimativa, competência, fornecedor e vínculo originais; nenhuma outra AP ou
movimentação é criada. Locks ciclo→AP, saldo canônico (inclusive reserva revista),
Zod strict, tenant/RLS e auditoria antes/depois na mesma transação.

Recusa correção com liquidação parcial/integral ou reserva antiga, mesmo com cache
zerado. É necessário estornar ou revisar a reserva primeiro. Reenvio com mesmos
valores não duplica efeitos/auditoria. Cancelamento de ocorrência já realizada
continua pendente e a mensagem informa essa limitação, sem encaminhar ao fluxo
genérico que recusa a operação. Não há schema/migration/backfill novo.

Typecheck/lint e 462 unitários aprovados. Foram acrescentados três testes DB de
correção, RBAC/tenant/payload/liquidação com cache obsoleto e rollback de auditoria,
além do E2E de correção pela ocorrência. A primeira suíte DB falhou porque os
novos cenários antecediam o teste existente que exige dashboard inicial vazio;
ordem corrigida sem relaxar as asserções. Reexecução/build/E2E em andamento.

Reexecução DB aprovada: 239 testes/40 arquivos (`provision-correction-db-final.log`).
Typecheck, lint e 462 unitários/75 arquivos aprovados. Build/E2E deste incremento
aguardam finalizar a execução completa anterior no servidor isolado; isso não
constitui aprovação final da V1. Correções de Gráfica/NF/SaaS/reembolso e
cancelamento de provisão realizada permanecem em revisão, além dos demais aceites.

### Checkpoint de gates — 09/10/2026

- Runtime `d895330` e testes `cd00f93`: `npm run test:e2e -- --workers=1`
  aprovado, 23/23 em 6,3 min (`e2e-legacy-review-full.log` na worktree isolada).
- `8daf360`: typecheck/lint/462 unitários/239 DB aprovados; build aprovado
  (`build-provision-correction.log`) e E2E focal da provisão aprovado
  (`provision-correction-e2e.log`). Corrige valor/vencimento pela UI e consulta a
  mesma AP com o novo valor, preservando estimativa e quantidade de títulos.
- `git diff --check` aprovado. Branch dedicada mantida. Worktrees externas e
  stash preexistentes preservados; nenhuma mudança em main/development, base
  habitual, runtime de localhost:3000 ou produção.

Esse é um checkpoint técnico, não o SHA final candidato nem a homologação humana.
Próximos P0: correção/cancelamento das origens Gráfica/NF/SaaS/reembolso e
cancelamento de provisão realizada; depois relatórios de competência/obrigações/
resultado, referências/perfis, dados fictícios consistentes, prova de restart e
gates completos no candidato final. Não aceitar fluxo que exige SQL do gestor.

### FIN-006 — cancelamento da provisão realizada

Cancelamento agora ocorre pela origem e cancela a mesma AP, com motivo, permissão
finance.write + finance.reverse, lock ciclo→AP e auditoria conjunta. O vínculo,
estimativa, valores/documentos e histórico permanecem; reenvio é idempotente e
não reabre ocorrência cancelada. Saldo canônico com alocações ou reserva legada
recusa cancelamento até estorno/revisão. Cancelamento planejado preserva acesso
finance.write; ambos endpoints usam o rate limit persistido de conciliação.

Migration 0059 gerada pelo drizzle-kit amplia o estado cancelado para manter
AP vinculada e acrescenta proteção de link e constraints diferidas dos estados.
Escritas diretas que cancelam somente AP/ocorrência, reabrem só um lado ou removem
o vínculo são recusadas. Sem tabela/backfill e sem mudanças em registros antigos.
Upgrade isolado 0050→0059 e 241 DB/40 arquivos aprovados (`provision-cancel-db.log`).
Inclui parcial com cache obsoleto, idempotência, guards de banco e rollback da
auditoria. Gates unitários/typecheck/lint finais e build/E2E ainda em execução.

Typecheck/lint e 465 unitários/76 arquivos aprovados. O teste existente de
cancelamento esperava common_mutation; atualizado para a proteção mais restrita
reconciliation. Três novos testes de Server Action cobrem acesso, tenant, payload,
rate limit e erros seguros. Build/E2E focal seguem pendentes neste registro.

`041abd6`: build aprovado (`build-provision-cancel.log`) e E2E focal aprovado
(`provision-cancel-e2e.log`) na worktree isolada. Gestor planeja, realiza uma AP,
corrige valor/vencimento, cancela a cobrança realizada e consulta a mesma AP
cancelada, preservando estimativa, valor/link e histórico. Nenhum arquivo/banco
habitual alterado, nenhuma migration de produção. Full E2E no candidato final
permanece necessário após as demais correções.

### FIN-006/010 — correção e leitura canônica da cobrança SaaS

Correção pela origem exige finance.write + finance.reverse, motivo e revisão
esperada, com rate limit persistido de conciliação. Locks assinatura→cobrança→AP;
atualização/auditoria dos dois registros na mesma transação. Competência/link/
estimativa preservados, sem outra AP/caixa. Reenvio é idempotente; revisão obsoleta
não sobrescreve outra correção. Saldo canônico liquidado/reserva bloqueia correção
até estorno/revisão. Schema Zod strict reaproveita validações de moeda/câmbio/IOF.

A leitura anterior usava o status cached da AP e podia mostrar pagamento sem
conciliação. Lista/status/valor conciliado agora usam ledger, com tenant explícito
no join e aviso de histórico reservado. Histórico de correções consultável na
origem usa fatos auditados do mesmo tenant/cobrança; expõe somente data, valores,
cotação, responsável e motivo, sem IP/user-agent ou logs de outros domínios.

Sem schema/migration/backfill novo. Typecheck/lint e 469 unitários/78 arquivos
aprovados; 245 DB/40 arquivos aprovados (`saas-correction-db-final.log`). A consulta
final de histórico/autor foi validada também em oito testes focais DB. Cobertura
de vínculo estável, concorrência, payload/tenant/permissões, rollback, cache pago
obsoleto com parcial real, estorno e correção posterior. Build/E2E ainda pendentes
neste registro. Cancelamento da cobrança SaaS é o próximo ponto desta origem.

Runtime `6d1134b`: build e E2E focal aprovados (`build-saas-correction-final.log`,
`saas-correction-e2e-final.log`). Cadastro, reenvio sem duplicação, correção com
câmbio/IOF, consulta dos valores anteriores/motivo e mesma AP com total corrigido
validados. O primeiro E2E encontrou um bug real no link da AP: competência de
dezembro abria o filtro financeiro de outubro. Link passou a levar competência
e busca, sem contornar filtros no teste. Atualização explícita de updatedAt da
cobrança em validação final; nenhum schema/migration novo.

Checkpoint `2e76442`: build e E2E focal novamente aprovados no mesmo runtime
(`build-saas-correction-verified.log`, `saas-correction-e2e-verified.log`). Oito
testes DB focais aprovados, incluindo leitura cruzada com ID real de cobrança
e auditoria. Atualização de updatedAt verificada. O cancelamento da cobrança e
o E2E completo no candidato final continuam pendentes; não há aceite humano.

### FIN-006/010 — cancelamento de cobrança SaaS e preservação da origem

Implementado cancelamento com motivo/confirmação/revisão esperada, finance.write
+ finance.reverse e rate limit persistido. Locks assinatura→cobrança→AP e audit
transacional dos dois registros; saldo canônico não zero bloqueia até estorno/
revisão. Reenvio não cancela a substituta nem repete efeitos. Uma substituta pode
ser cadastrada na mesma competência mantendo a anterior cancelada, com uma única
ativa. Correção não reabre cobrança cancelada. Estimativa/contrato e caixa intactos.

Identificado e corrigido caminho de remoção de assinatura com histórico de
cobranças: bloqueio no servidor e no banco para manter a origem consultável.
0060 gerada por drizzle-kit adiciona campos/índice parcial/check e guards de
vínculo imutável, registro cancelado imutável e estados fonte/AP concordantes.
Backfill conserva APs já canceladas e registra explicitamente observação da
migration/autor desconhecido; nenhum vínculo/caixa inventado. Aplicação só DB
isolado, com teste da migration real em schema temporário exclusivo.

14 testes DB focais e 472 unitários/79 arquivos aprovados; lint aprovado.
Typecheck identificou inferência ampla de array no teste, corrigida com tipo
AccessContext explícito. Typecheck final, DB completo, build e E2E em execução.

Typecheck final aprovado (`saas-cancel-typecheck-final.log`). DB completo
aprovado: 251 testes/41 arquivos (`saas-cancel-db.log`), incluindo RLS, migration
e regressões das demais origens. Build e navegador aguardam o checkpoint Git.

Revisão de segurança: sessão na action, ambas permissões no servidor/DAL, Zod
strict, IDs filtrados por organização/assinatura/AP e RLS existente preservado.
Rate limit persistido, dinheiro sem float, locks e auditoria transacional.
Sem novos uploads, alteração de sessão ou exposição de segredos; documentos
financeiros continuam ligados à mesma AP privada. Nenhuma tabela de negócio
nova ou mudança de policy. Worktrees anteriores e base habitual preservadas.

Checkpoint técnico `1095c53a1c50d84f5036701e1dfb143cec0a7716`: build aprovado
(`build-saas-cancel.log`), E2E focal aprovado (`saas-cancel-e2e.log`) e comando
completo `npm run test:e2e -- --workers=1` aprovado: 23/23, 6,3 minutos,
exit 0 (`saas-cancel-e2e-full.log`), na worktree isolada com esse mesmo SHA.
O cenário SaaS verifica valores antes/depois, motivo, AP cancelada preservada,
substituta na mesma competência e uma AP ativa. 0060 aplicada também no banco
isolado E2E. Typecheck/lint/472 unitários/251 DB aprovados nos logs desta seção.
`git diff --check` limpo. Nenhum gate obrigatório conhecido falhando neste
checkpoint; isso não é candidato final nem conclusão da homologação humana.

Próxima origem P0: Gráfica. `sale.ts`/`commitment.ts` já criam AR/AP uma vez;
`0034`/`0036` protegem os registros de origem com imutabilidade. O Financeiro
genérico recusa edição econômica desses títulos, mas falta correção pela origem.
Implementar sem reescrever venda/contratação históricas, mantendo conciliação,
resumo, parcelas e auditoria concordantes. Não recriar o fluxo gráfico existente.

### FIN-006/GRF — correção da AP de contratação e saldo após lock

Correção pela origem gráfica implementada com finance.write + finance.reverse,
motivo, revisão esperada e rate limit persistido. Locks trabalho→contratação→AP;
atualiza somente valor/vencimento/competência da mesma AP. Cotação e contratação
imutáveis, fornecedor, vínculos e documentos preservados. Audit dos dois donos
na mesma transação, reenvio idempotente e histórico consultável com campos
selecionados por tenant/AP/contratação, sem IP/user-agent. Link abre a competência
da AP. Resumo/dashboard já consultam o valor atual da mesma obrigação.

Teste concorrente real espera uma conciliação que mantém o lock da AP e comprova
que a correção deve recusar após o pagamento ser commitado. Uma prova negativa
temporária, restaurada imediatamente, recolocou a leitura do saldo na consulta
de aquisição do lock: o teste detectou correção indevida (fulfilled em vez de
rejected; `graphic-payable-race-negative-probe.log`). Com leitura separada após
o lock, 23 testes DB focais passaram (`graphic-payable-db-focus.log`).

Mudança adjacente indispensável: Financeiro manual, SaaS e provisões tinham o
mesmo padrão de snapshot anterior à espera pelo lock. Seus caminhos sensíveis
agora relêem o saldo canônico em uma nova consulta depois do lock, evitando
aceitar correção concorrente à liquidação. Não altera regras/permissões nem
enfraquece imutabilidade. Nenhuma migration/backfill novo.

Typecheck/lint e 475 unitários/80 arquivos aprovados. DB completo em execução;
build/E2E aguardam checkpoint Git. Cobertura negativa de tenant, IDs, permissões,
AP cancelada, parcial com cache zero, concorrência observada no PostgreSQL e
rollback de auditoria. E2E integrado ampliado para corrigir custo 1200→1250 e
conferir a mesma AP/histórico, resumo, dashboard e pagamentos parciais 300+950.

DB completo aprovado: 254 testes/41 arquivos (`graphic-payable-db.log`), com
regressões de Financeiro, SaaS, provisões e RLS. Typecheck/lint/unit nos logs
`graphic-payable-typecheck.log`, `graphic-payable-lint.log` e
`graphic-payable-unit.log`. Build e E2E ainda pendentes neste registro.
