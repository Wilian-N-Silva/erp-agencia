# Validação para os manuais de usuários

Data: 22/09/2026. Branch: `codex/user-workflows-manuals`, baseada em development
`b962596`. Escopo: validar o comportamento existente e produzir manuais para Gestão,
Gráfica e Portal (PORT-003/manual v2). Não implementa antecipadamente as tasks de
integração financeira de NF, reembolso ou saldo de férias.

## Conclusão operacional

O envio de PDF de NF funciona no portal PJ, com valor digitado manualmente e sem
OCR. O arquivo recebido foi baixado pelo próprio colaborador e comparado byte a
byte com o enviado. O fluxo documental permite ajuste, reenvio, aprovação e registro
legado de pagamento. Isso **não homologa o ciclo financeiro novo de NF até conciliação**.

Os três manuais estão em [docs/manuais](../manuais/README.md). São instruções para
a versão atual, com limitações explícitas. A liberação irrestrita à equipe não é
recomendada enquanto os bloqueios abaixo permanecerem.

## Evidência e cobertura

| Fluxo | Evidência | Limite da conclusão |
|---|---|---|
| Financeiro publica composição para PJ | E2E cria competência, total e descrição fictícios pela interface | Não há agendamento mensal demonstrado |
| PJ envia NF PDF | E2E envia arquivo, consulta Documentos, baixa e compara bytes | PDF de teste; não valida conteúdo fiscal nem realiza OCR |
| Revisão/ajuste/aprovação/status de pago | E2E usa sessões separadas de PJ e Financeiro | Status legado, não conciliação de AP |
| Restrição de portal | PJ acessa `/app/nfs` e volta a `/portal` | Não é pentest completo de todos os endpoints |
| Reembolso com comprovante | E2E envia PDF e acompanha gestor, Financeiro e pago no portal | Integração com AP nova não homologada |
| RH | E2E de solicitação PJ de pausa e aprovação; consulta de cadastros/documentos/NFs | Não prova reserva/cancelamento/concorrência de saldo CLT |
| Diretoria | Acesso a rotinas de gestão e download da NF com bytes conferidos | Conta demo com perfil Diretoria, não contas reais |
| Gráfica | E2E operacional e importação histórica já existentes, reexecutados | Perfil exclusivo de operador ainda não existe |

Os testes estão em `tests/e2e/portal-invoice-workflow.spec.ts`,
`graphics-os.spec.ts`, `graphics-import.spec.ts` e `critical-flows.spec.ts`.
A imagem local `storage-local/manual-validation/portal-invoice-paid.png` foi
inspecionada: mostra o formulário da próxima composição e o histórico de NFs pagas.
Não é usada como evidência de transferência bancária.

## Pendências identificadas

| Prioridade | Achado | Efeito e encaminhamento |
|---|---|---|
| Alta | Baixar PDF no detalhe de NF desabilitado; ação do menu sem implementação | Revisão documental não pode depender desse botão. Conectar acesso autorizado ao documento |
| Alta | Conta apenas Financeiro recebe HTTP 500/AccessDenied ao baixar a NF | Diretoria consegue baixar; RH tem permissão documental no contrato. Definir acesso financeiro específico sem abrir todos os documentos sensíveis e tratar negação com erro adequado |
| Alta | Aprovação de NF grava `financialExpenses`; NF não possui relação explícita com os novos títulos | Concluir INV-001..004 antes de considerar NF→AP→conciliação validada |
| Alta | Marcar pago na NF altera status próprio; não deriva de conciliação | Evitar lançamentos duplicados e não usar esse status como prova bancária |
| Alta | Não há role padrão exclusiva para Gráfica | `technical_admin` inclui operação gráfica e configuração técnica. Não atribuir esse perfil à Paula apenas para operar Gráfica; definir e testar perfil restrito |
| Média | Portal informa geração automática da próxima composição sem fluxo automático comprovado | Corrigir texto; Financeiro precisa publicar a composição |
| Média | Portal destaca somente uma NF aberta | Competências anteriores podem ficar sem seleção direta; criar navegação entre solicitações |
| Média | Observação interna no detalhe desabilitada | Pedidos de ajuste precisam de comunicação externa até haver motivo persistido na interface |
| Média | XML não está no formulário de envio de NF | Backend documental genérico aceita XML, mas fluxo de NF da interface oferece PDF. Não anunciar XML como funcionalidade homologada |
| Média | Seed contém metadado de contrato cujo arquivo não existe | Download/prefetch gera ENOENT/500 para o contrato demo. Arquivos novos enviados no teste existem e puderam ser baixados |

As pendências de reembolso→AP (REI-002..004) e saldo de férias (VAC-001..005)
continuam fora da homologação financeira/saldo completa. As rotinas documentais
existentes não substituem esses critérios.

## Segurança e dados

Não foram cadastrados Jaciane, Saulo, Wilian, Guilherme, João Pedro, Ariane, Pitter,
Michael, Gustavo, Natalia, Larissa, Dereck ou Paula. A referência aos 13 integrantes
consta somente nos manuais, sem inferir vínculo CLT/PJ ou conceder roles reais.

Sessões de teste são separadas por perfil. Os testes usam dados demo em PostgreSQL
local, uploads locais e identificadores `QA-MANUAL-*`; datas muito futuras isolam
composições e pausas do uso cotidiano. Registros de tentativas anteriores foram
preservados. Não houve migration, backfill, alteração de permissões ou implantação
remota. A Vercel permanece fora desta validação.

O controle de organização/RBAC é existente; negar download ao Financeiro não é
evidência suficiente de uma API de erro correta. O HTTP 500 foi registrado como
defeito, não mascarado como resposta 403 válida. A verificação de uploads atual
confere metadados/tamanho; os testes aqui não certificam todos os conteúdos maliciosos.

## Reprodução

Com PostgreSQL demo local e build já preparado, forneça `DEMO_USER_PASSWORD`
ao processo de teste. Execute `npm run test:e2e -- --workers=1`.
Para repetições da importação, foi usado `RATE_LIMIT_GRAPHICS_IMPORT_LIMIT=30`
somente no processo E2E; o padrão de produção não foi alterado. O teste respeita
`Retry-After` do login e espera conclusão das ações antes de consultar outra sessão.

Os logs desta execução ficam em `storage-local/manual-validation/manuals-*` e
`portal-invoice-workflow.log`, ignorados pelo Git.

Resultado final: `npm run test:e2e -- --workers=1` com **8 cenários aprovados**,
incluindo três novos cenários de Portal/Gestão. `npm run test`: **373 testes
aprovados**. Typecheck, lint, links locais e `git diff --check` aprovados.
Nenhum código de runtime ou schema foi alterado: o E2E executou a build existente
do mesmo código de aplicação. Não foi necessário gerar nova build/migration.

As falhas intermediárias de seletores (MoneyInput usa campo oculto, datas da lista
são separadas do ano), espera de atualização entre sessões e HTTP 429 de login
foram corrigidas no teste, sem relaxar as proteções da aplicação. O erro 500 de
download financeiro permanece documentado como pendência real. Não foi repetida
a suíte de banco nesta task de documentação/testes de interface. A worktree
preexistente `sec-002` foi preservada.
