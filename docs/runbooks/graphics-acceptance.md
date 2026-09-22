# Gráfica — aceite GRF-005 a GRF-014

Verificação de 22/09/2026. Implementação revisada contra `development` em `codex/graphics-completion`. Este relatório descreve o módulo local; não é homologação de produção nem validação com usuários reais.

## Matriz de aceite

| Task | Comportamento comprovado | Evidência no repositório |
|---|---|---|
| GRF-005 | OS externa PDF, versões imutáveis, aviso de duplicidade, download privado e rollback do arquivo | `os-registration.ts`, `os-dal.ts`, `graphics-os.test.ts` (unitário/banco), `graphics-os-download.test.ts`, E2E operacional |
| GRF-006 | Aprovação/rejeição/revisão do cliente vinculada à versão atual; contato/canal/data/evidência; concorrência e histórico | `client-decision.ts`, testes de decisão/evidência, integração `graphics-os.test.ts`, E2E |
| GRF-007 | Produção, espera com motivo/responsável, pendência, retomada, entrega e encerramento | `production.ts`, `production-rules.ts`, migração 0044, integração e E2E |
| GRF-008 | Contratação explícita cria AP uma única vez, em transação; aprovação isolada não cria obrigação | `commitment.ts`, integração de concorrência/rollback/tenant, E2E de contratação e pagamento |
| GRF-009 | Venda aprovada cria AR parcelada com soma exata; não cria caixa | `sale.ts`, `sale-rules.ts`, integração de idempotência/rollback, E2E de sinal/saldo e erro preservando campos |
| GRF-010 | Contratado/AR/recebido/custos/AP/pago derivados dos títulos e alocações; margem indisponível se vínculos não confiáveis | `finance-summary.ts`, `finance-summary-rules.ts`, testes unitários/banco, E2E de saldo após recarga |
| GRF-011 | Gráfica sugere; somente Financeiro com `finance.settle` confirma; rejeição e auditoria preservadas | `reconciliation.ts`, integração e E2E de sugestão sem baixa automática |
| GRF-012 | Filtros, indicadores operacionais, atrasos, pendências e totais financeiros sob permissão própria | `dashboard.ts`, `dashboard-rules.ts`, teste de acesso da página, integração e E2E |
| GRF-013 | XLSX de três blocos, origem preservada, prévia sem writes financeiros, revisão explícita, pendências navegáveis, relatório e confirmação idempotente | `import-*`, unitários do parser/formulário, integração `graphics-import.test.ts`, E2E `graphics-import.spec.ts` |
| GRF-014 | Fornecedor cadastrado na Gráfica → primeira cotação rejeitada → alternativa aprovada → OS/revisão/cliente → AP/AR → conciliação → produção/espera/entrega/encerramento → pagamento; recebimento de R$800 dividido entre dois trabalhos | `tests/e2e/graphics-os.spec.ts`, `tests/e2e/graphics-import.spec.ts` |

Os arquivos de implementação citados ficam em `src/features/graphics`; testes unitários em `src/tests` e de banco em `tests/integration`. A evidência cronológica e os commits estão em `graphics-completion-progress.md`.

## Segurança e dados

Sessão e RBAC são validados no servidor. DAL e RLS delimitam organização; FKs compostas e testes negativos cobrem IDs de outra organização, ausência de contexto, payload adulterado e acesso a documentos. Mutações financeiras e auditoria usam transações e locks; testes verificam concorrência, rollback e repetição. Uploads têm validação de tipo/conteúdo/tamanho e chaves privadas; export/download exigem autorização. Limites persistentes de requisições continuam ativos.

Migrações 0026–0044: documentos/OS, decisões, produção, compromissos, venda/parcelas, permissões, sugestões e importação. Sem backfill que invente movimentação financeira. Teste de instalação vazia aplica 0000–0044 e fixtures mínimas; upgrade conserva OS/documentos preexistentes. Matriz RLS é exercitada pela suíte de banco com credencial runtime restrita.

A dependência de anexos necessária à Gráfica usa o catálogo compartilhado `files`, helpers existentes de validação/storage e vínculos tenant próprios de cotação/OS/decisão. Não se declara concluída a generalização global DOC-001/002 para outros domínios; o contrato necessário ao fluxo gráfico foi verificado pelos testes de upload/download, rollback e isolamento.

## Gates e limites da evidência

- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: aprovados.
- `npm run test`: 370 testes aprovados.
- `npm run test:db`: 164 testes aprovados, incluindo instalação vazia e upgrade.
- `npm run test:e2e -- --workers=1`: 5 cenários aprovados, com vários passos por cenário.
- Inspeção manual em localhost: dashboard e acesso ao formulário de fornecedores. Detalhe a 390px verificado sem overflow horizontal e screenshot inspecionado.
- E2E repetido eleva `RATE_LIMIT_GRAPHICS_IMPORT_LIMIT` apenas no processo de teste a 30; padrão da aplicação permanece 3 arquivos/hora. Testes de rate limit verificam o mecanismo separadamente.

Avisos locais conhecidos: HTTP localhost gera aviso do Better Auth; pg emite aviso de consultas concorrentes no mesmo cliente em leituras existentes. Não houve falha funcional nos gates. Produção/R2 não foi publicada ou homologada nesta execução. Importação histórica é manualmente revisada e não concilia caixa por texto/número da OS.

## Roteiro para testar

1. Abra `http://localhost:3000/app/grafica`. Use a conta demo `todos.perfis@formula.local` e a senha de validação fornecida na conversa.
2. Em **Consultar e cadastrar fornecedores**, cadastre um fornecedor. Volte e crie um trabalho, escolhendo cliente e responsável. Há cinco clientes demo; os registros QA são fictícios.
3. Cadastre uma cotação, rejeite com motivo e adicione uma alternativa. Aprove a alternativa. Observe que a rejeição preserva o histórico e o trabalho existe antes da OS.
4. Registre um PDF externo de OS. Peça revisão do cliente, registre nova versão e aprove a versão atual com contato/canal/data.
5. Confirme a contratação e a AP. Registre a venda com sinal/saldo. Confira que os títulos foram criados e os recebimentos/pagamentos continuam zerados.
6. Registre uma movimentação no Financeiro. Sugira o vínculo pela Gráfica e confirme no Financeiro. Para um recebimento de vários trabalhos, distribua o valor entre os respectivos títulos.
7. Avance produção, registre espera com motivo/responsável, retome, entregue e encerre. Concilie o pagamento com a AP e confira o resumo financeiro.
8. Em **Importar histórico**, mapeie as abas/colunas, revise os vínculos e confirme. Dados duvidosos permanecem pendentes; abra a linha por Alertas. Baixe o relatório para comparar origem, decisões e registros criados.

Para uso recorrente, utilize busca/filtros por etapa, cliente, responsável e projeto e os links de etapa do dashboard. Encerramento operacional não significa liquidação financeira. Registros QA de tentativas anteriores foram preservados; o trabalho original do usuário não foi apagado.
