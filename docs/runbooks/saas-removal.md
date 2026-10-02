# Remoção de cadastro incorreto de assinatura

Correção do fluxo SaaS solicitada na validação manual. Branch
`codex/saas-remove-mistake`, com a correção de custos de `codex/saas-current-cost`.
Não conclui o modelo v2 nem a integração financeira futura SAA-004.

Abra Assinaturas → assinatura → Contrato → Remover cadastro incorreto. Informe
o motivo (5 a 500 caracteres), marque a confirmação e confirme a remoção.
O cadastro desaparece da lista, dos totais e das consultas do portal; seu endereço
passa a retornar 404. A exclusão usa `deleted_at`: não apaga fisicamente a linha
nem a auditoria. Essa retenção segue AGENTS.md e PRD 05.

Cancelar assinatura é uma operação diferente: encerra o estado operacional do
contrato, mas mantém a assinatura consultável com o valor histórico. Não cancela
um serviço no fornecedor externo e não quita uma cobrança financeira.

A remoção recusa assinaturas com qualquer histórico de colaboradores vinculados
(mesmo inativo), documentos ou pendências. Nesse caso, use o cancelamento. Não
há vínculo financeiro automático SaaS no modelo atual; títulos lançados
manualmente não são apagados por esta operação.

## Segurança e integridade

- Autenticação e sessão ativa pelo contexto existente; RBAC `saas.write` ou
  `saas.configure` verificado no servidor.
- ID UUID, motivo e confirmação explícita validados por Zod estrito; organização
  e autor vêm da sessão, impedindo mass assignment.
- Busca e escrita filtradas pela organização, dentro da transação tenant/RLS.
- Bloqueio da assinatura serializa remoção e os writers existentes, incluindo
  vínculo de colaborador; registros removidos não aceitam novas operações.
- Auditoria before/after e motivo na mesma transação; falha de auditoria reverte
  a remoção. Redirect ocorre somente após commit.
- Rate limit persistente `common_mutation`; erro esperado apresentado no formulário.
- Nenhuma alteração de upload, credenciais, sessões ou exposição de custos.
- Sem schema novo, migration ou backfill; usa campo e policies já existentes.

## Verificação

`saas-removal-action.test.ts`: RBAC, aplicação do rate limit, mensagem de negócio
e redirect depois da remoção. `tests/integration/saas-removal.test.ts`: exclusão
no DAL, auditoria, cross-tenant, payload adulterado, confirmação, vínculos ativos
e inativos, pendências, rollback e remoção concorrente. E2E cadastra um registro
fictício, remove pela interface, recarrega e verifica 404, além de tentar remover
uma assinatura com colaborador e confirmar o bloqueio. O E2E de custos testa
separadamente o cancelamento e a preservação do contrato.

Validação de 30/09/2026: typecheck, lint, build e 380 testes unitários aprovados.
Suite de banco: 172 testes aprovados; após acrescentar o caso de documento,
os 9 testes focados de remoção também passaram. E2E: 6 casos aprovados na suite;
o sétimo encontrou um seletor ambíguo entre o alerta do formulário e o anunciador
do Next. Corrigido o seletor, o caso de remoção passou em nova execução.

Verificação manual no navegador: removido o cadastro fictício
`QA-SET30-Assinatura-cadastro-errado`, ID `15d26a89-e905-434d-9f09-b4f1febd4e3d`.
Consulta somente leitura confirmou `deleted_at` preenchido e auditoria `delete`
com o motivo informado. Captura local: `storage-local/manual-validation/saas-removal-dialog.png`.
Console sem erros; permanecem os avisos de ambiente local HTTP e depreciação do
driver PostgreSQL, já presentes antes desta alteração.
