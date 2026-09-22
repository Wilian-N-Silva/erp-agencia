# Runbook: rollout do vinculo User - Employee (ACC-003)

A ACC-003 usa rollout `expand -> cleanup -> constraint`. A migration `0013`
nao cria um indice unico: ela preserva todos os vinculos aceitos pelo schema
anterior e instala um guard que rejeita apenas novos conflitos. O runtime tambem
serializa a escrita administrativa por User.

## 1. Inventario antes do deploy

Execute com a credencial administrativa controlada, nunca pela aplicacao:

```sql
SELECT
  e.organization_id,
  e.user_id,
  u.email,
  count(*)::integer AS employee_count,
  jsonb_agg(
    jsonb_build_object(
      'employeeId', e.id,
      'registrationNumber', e.registration_number,
      'fullName', e.full_name,
      'deletedAt', e.deleted_at
    )
    ORDER BY e.created_at, e.id
  ) AS employees
FROM employees e
LEFT JOIN "user" u ON u.id = e.user_id
WHERE e.user_id IS NOT NULL
GROUP BY e.organization_id, e.user_id, u.email
HAVING count(*) > 1
ORDER BY e.organization_id, e.user_id;
```

Salve o resultado no registro operacional do deploy. Nao altere nem remova linhas
automaticamente.

## 2. Aplicar a fase expand

1. Crie backup/snapshot conforme `backup-restore.md`.
2. Aplique `npm run db:migrate` no ambiente administrativo controlado.
3. Confirme que a migration concluiu mesmo quando o inventario possui conflitos.
4. Faca o deploy da aplicacao ACC-003.

`DATABASE_DIRECT_URL` pertence somente a migration, seed e administracao
controlada. O runtime continua usando apenas `DATABASE_URL`, com a role de
aplicacao `NOBYPASSRLS`.

## 3. Cleanup explicito

Em `/app/configuracoes`, cada User ambiguo aparece uma unica vez, marcado como
`Conflito legado`, com todos os Employees envolvidos. Um administrador com
`settings.manage` deve selecionar explicitamente o Employee correto ou escolher
`Sem vinculo`.

A acao:

- valida User e Employee dentro da mesma organizacao;
- remove os vinculos conflitantes e estabelece a escolha em uma transacao;
- registra no audit log todos os Employee IDs anteriores e o resultado;
- nao escolhe vencedor por ordem, nome ou outra heuristica.

Enquanto houver conflito, o portal trata o User como sem Employee e permanece
bloqueado.

## 4. Gate verificavel para a fase contract

Repita a consulta da secao 1. O resultado deve ter zero linhas. Verifique tambem
os audit logs `entity_type = 'user_employee_link'` e execute a suite DB da
ACC-003.

A troca do indice `employees_user_idx` por `UNIQUE` fica para uma migration
contratual posterior, somente depois desse gate estar limpo em todos os ambientes.
Nao altere `0013` depois de aplicada e nao antecipe a constraint durante o cleanup.

## Rollback

O schema expandido e compativel com rollback do codigo. Em incidente, reverta o
deploy da aplicacao e mantenha function/trigger e dados; nao execute down migration
destrutiva. O trigger nao modifica conflitos legados, apenas impede novos conflitos.
