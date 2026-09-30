# Gráfica — organização do trabalho por etapas

Task: refinamento visual de GRF-002 e dos fluxos GRF-003..014, conforme
[planejamento aprovado](../decisions/graphics-workspace-ux.md).
Branch: `codex/graphics-workspace`. Integração em development pendente.

## Implementação

- Cabeçalho com identificação, responsável, prazo e situações operacional/financeira.
- Andamento Pedido → Cotações → OS → Cliente → Produção → Entrega, com próxima ação.
- Oito abas, incluindo Visão geral, Financeiro e Documentos e histórico.
- URL `?tab=`, recarga, histórico do navegador e navegação de abas por teclado.
- Formulários em painéis modais com foco contido, Escape e preservação do rascunho
  ao fechar e alternar abas. Rascunhos não persistem após sair/recarregar.
- Comparação de cotações, anexos recolhidos, OS atual destacada e versões anteriores
  expansíveis. A decisão exibida no resumo corresponde à OS vigente.
- Bloqueios operacionais continuam orientando o usuário sobre o requisito faltante.
- Confirmação antes de arquivar. Financeiro permanece consultável após encerramento.

## Segurança e dados

Não há mudança de schema, migration, backfill ou limpeza da base nesta task. Reutiliza DAL,
RLS e Server Actions existentes: autenticação, autorização, escopo organizacional,
Zod, rate limiting, transações e auditoria continuam no servidor. As abas não
substituem permissões. O resumo financeiro só é enviado quando autorizado. URLs
de download mantêm seus controles de acesso. Nenhum novo upload ou endpoint.

## Validação

- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Unitários: revisão do cliente retorna à OS, espera conserva etapa anterior,
  encerramento mantém acompanhamento financeiro e aba inválida volta ao resumo.
- E2E `graphics-os.spec.ts`: cotações/rejeição, duas versões de OS, evidência,
  aprovação, contratação/AP, venda/AR parcelada, conciliação, produção e encerramento.
- E2E `graphics-workspace.spec.ts`: rascunho entre abas, teclado, voltar, recarga,
  URL inválida, documentos, celular, cancelamento do arquivamento e Financeiro sem edição.
- Capturas de desktop e celular em `storage-local/manual-validation/` (não versionadas).

Resultado em 30/09/2026: **398 testes unitários e 4 E2E da Gráfica aprovados**;
typecheck, lint, build e `git diff --check` aprovados. O build e a rodada final
de E2E rodaram na worktree `invoice-download-validation`, com os mesmos arquivos
da implementação, para não disputar `.next` com o servidor dev da porta 3000.
O teste de login respeita `Retry-After` em caso de rate limiting. A rota `/login`
do sistema local retornou HTTP 200.

## Arquivos da task

- `src/app/(private)/app/grafica/[id]/page.tsx`: conteúdo organizado em painéis por etapa.
- `src/app/(private)/app/grafica/workspace.tsx`: andamento, abas, URL e teclado.
- `src/app/(private)/app/grafica/workspace-panel.tsx`: painel modal e confirmação de arquivo.
- `src/features/graphics/workspace-rules.ts`: resolução de etapa e próximo destino.
- `src/tests/graphics-workspace.test.ts`: quatro testes novos das regras de navegação.
- `tests/e2e/graphics-os.spec.ts`: adaptação do fluxo completo para abas e painéis.
- `tests/e2e/graphics-workspace.spec.ts`: dois testes novos de navegação e consulta restrita.
- Planejamento, este registro de validação e `docs/manuais/grafica.md` atualizados.

Limites: não há persistência de rascunhos entre sessões; a tela continua carregando
os dados autorizados das seções no servidor, como antes. Não há novos gates de
negócio. A suíte de banco não precisou ser alterada, pois não houve mudanças em
queries, autorização ou persistência nesta task visual.

As outras worktrees existentes foram preservadas: `sec-002` e
`invoice-download-validation`. As alterações anteriores do protótipo/apresentação
não integram esta task. A limpeza da base foi cancelada pelo usuário.
Os E2E operacionais usam a base local e adicionam registros de validação identificados
como QA/OS-E2E, assim como a suíte existente; não executam reset.
