# Correção de criação — digest 2138000903

Em 22/09/2026, o log local identificou o digest informado como violação da constraint `graphic_jobs_internal_code_idx` (PostgreSQL 23505): o código `QA-GRF-20260921` já existia. A tentativa era de criar um trabalho da Gráfica, não um novo registro de projeto/evento.

Correção em `codex/graphics-create-validation`, derivada de development: criação e edição traduzem apenas esse conflito conhecido em mensagem orientativa, após rollback da transação. A unicidade por organização permanece no banco, inclusive sob concorrência. Erros de permissão e outros erros não são reinterpretados como duplicidade. Nenhuma migration, backfill ou exclusão de dados.

Novo formulário de trabalho exibe resultado acessível, impede reenvio enquanto salva e preserva os campos quando o servidor retorna conflito ou rate limit. A criação continua redirecionando ao trabalho; edição informa sucesso. Arquivos: `src/features/graphics/actions.ts`, `src/lib/server-action-result.ts`, `src/app/(private)/app/grafica/job-action-form.tsx`, páginas de criação/detalhe.

Validação:

- typecheck, lint, build e diff-check aprovados;
- 373 testes unitários e 164 testes de banco aprovados;
- quatro cenários E2E gerais passaram; o operacional inicialmente falhou por seletor ambíguo entre o alerta da aplicação e o anúncio de rota do Next.js. Seletor corrigido e cenário completo reexecutado com sucesso;
- regressão E2E reproduz o mesmo código duplicado, verifica mensagem e preservação de título/descrição, corrige só o código, cria o trabalho, repete o conflito na edição e prossegue por fornecedores/OS/AR/AP/produção/conciliação/encerramento/pagamento;
- testes unitários verificam tratamento seguro de conflito tanto na criação quanto na edição e preservação de outros erros.

A evidência cobre os cenários executados e a causa reportada, sem afirmar ausência de qualquer outro defeito. Nenhum dado do usuário foi apagado ou sobrescrito. Worktree sec-002 preexistente preservada.
