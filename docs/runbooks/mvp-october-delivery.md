# Entrega do MVP — 02/10/2026

Consolidação autorizada pelo usuário: branches de implementação e manuais →
development → main. Main é a versão para instalação/teste. As branches históricas
são preservadas; não há necessidade de removê-las para usar a versão consolidada.

## Incluído

- Gráfica organizada por etapas/abas, fornecedores, cotações, OS, cliente,
  produção/entrega, documentos/histórico e integração AR/AP/conciliação.
- PJ: tempo de vínculo e referência anual, 30 dias acumulados por ano completo,
  descanso de dias corridos com quantidade editável, venda aprovada pela responsável
  configurada e inclusão única em NF elegível. Sugestão usa remuneração atual/30.
- Composição da NF, envio/retorno de PDF, download autorizado, aprovação vinculada
  à conta a pagar e pagamento derivado das conciliações. Reembolso incluído na NF
  acompanha sua quitação.
- Clientes com fee, obrigação mensal, movimentação e conciliação de recebimento.
- Assinaturas: cadastro, remoção de erro sem histórico por soft-delete auditado,
  cancelamento, custo corrente, BRL/USD/EUR, mensal/anual e cotação estimada com
  data/fonte. Preserva formulário após erro de validação.
- Manuais de Gestão, Gráfica e Portal integrados e atualizados.

## Limites explícitos do MVP

- Assinaturas ainda não geram AP/provisões ou cobranças efetivas automaticamente.
  IOF/tarifas e câmbio efetivo devem ser conferidos na fatura. Custo é estimativa.
- Reembolso direto ainda utiliza fluxo legado; não é AP automática. Inclusão na NF
  possui leitura financeira, mas a revisão completa REI-003 ainda está pendente.
- Estorno financeiro pela UI e cancelamento/reabertura de férias continuam pendentes.
- Parcelamento geral futuro não está implementado fora dos fluxos já validados.
- Emissão fiscal continua externa, sem OCR. Não há pagamento bancário automático.
- Dados QA permanecem no ambiente local; não rodar limpeza nem seed de demonstração
  sobre dados reais. Todas as pessoas reais foram informadas como PJ; fixtures
  históricos não foram convertidos arbitrariamente.

## Instalação e execução

Siga [configuração de ambiente](environment-setup.md) para criar roles restritas,
segredos, autenticação e storage. Não copie credenciais do ambiente demo para produção.

```powershell
git checkout main
git pull --ff-only origin main
npm ci
# Preencha .env conforme .env.example e o guia de ambiente.
docker compose up -d postgres
npm run db:migrate
npm run build
npm run start
```

Docker Compose sobe PostgreSQL; a aplicação roda pelos comandos npm acima. Em
instalação nova, execute o bootstrap administrativo descrito no guia antes do login.
Em banco existente, preserve usuários e dados; não recrie o volume. Migrations
adicionadas nesta entrega: 0045, 0046 e 0047, todas expansivas. Aplique antes do
runtime novo. No ambiente local desta validação, `.env` usa `POSTGRES_PORT=15432`
e URLs na mesma porta porque o Windows reservou 55432. A porta padrão segue 55432.

Uploads locais precisam de disco persistente; R2 privado é alternativa conforme
o guia. Hospedagem Vercel não é requisito desta entrega e não foi reativada.

## Integração e preservação

A branch antiga de manuais tinha testes que exigiam baixa manual de NF e aprovação
PJ pela rotina anterior. Esses cenários foram substituídos pelos E2Es atuais de PJ,
NF, cliente e SaaS. O cenário de reembolso com PDF foi preservado para revalidação.
Conflitos na política PJ e manual da Gráfica foram resolvidos em favor das regras
confirmadas e da interface atual. Não foi usado merge que descarte branches inteiras.

Arquivos locais da apresentação/protótipo dispensada pelo usuário estão preservados
no stash nomeado `preserve local mockup and draft docs before MVP consolidation`.
Não fazem parte da entrega. Worktrees de validação e SEC-002 foram preservadas.

## Verificação da integração

Os E2Es respeitam o rate limit real do login, aguardando `Retry-After` quando a
sequência de contas compartilha o mesmo IP. A proteção de produção permanece ativa.
O teste de download procura PDFs usando `LOCAL_UPLOAD_DIR`, a mesma configuração
do runtime; não confunde arquivos de outro checkout com arquivos disponíveis.

Esta consolidação não altera autenticação, autorização, RBAC, DAL/RLS, validação
Zod, auditoria ou transações das funcionalidades integradas. Os gates de banco
cobrem isolamento, migrations e regras financeiras; os E2Es cobrem também acessos
operacionais e financeiros distintos, retorno/download de arquivos e conciliação.
Nenhuma credencial privada é versionada.

Gates aprovados em 02/10/2026:

- `npm run typecheck` e `npm run lint` sem erros.
- `npm run test`: 406 testes em 62 arquivos.
- `npm run test:db`: 200 testes em 32 arquivos, incluindo migrations e isolamento.
- `npm run build`: aprovado na worktree de validação com o mesmo código runtime.
- `node --env-file=.env node_modules/@playwright/test/cli.js test --workers=1`:
  15 E2Es aprovados em 3,3 minutos, contra a build de produção local na porta 3100.
- `git diff --check`: sem erros.

O build e os E2Es usaram uma worktree isolada para não disputar `.next` com o
servidor local. O código runtime foi comparado com o checkout de entrega.
Os testes locais não comprovam provisionamento ou disponibilidade de hospedagem remota.
