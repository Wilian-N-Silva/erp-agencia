# 07 — Estratégia de testes

## 1. Objetivo

Garantir que cada task entregue comportamento verificável sem depender de validação manual tardia. Teste é parte da task, não uma wave opcional no final.

## 2. Pirâmide

### Unit

Regras puras:

- state transitions;
- cálculo financeiro;
- férias;
- validação de alocações;
- deduplicação de work items;
- parse/import da Gráfica.

### Integration/DAL

Com banco real/isolado quando necessário:

- transações;
- RLS;
- scopes;
- constraints;
- migrations/backfill;
- concorrência financeira/férias;
- rate limiting Postgres.

### Security

Testes negativos específicos:

- IDOR;
- cross-org;
- role escalation;
- payload tampering;
- sessão revogada;
- upload inválido;
- rate limit;
- export sem permissão;
- RLS sem contexto.

### E2E

Playwright para fluxos críticos completos e UI real.

## 3. Gates por task

Toda task:

```bash
npm run typecheck
npm run lint
npm run test
```

Task com UI/rota crítica:

```bash
npm run build
npm run test:e2e
```

Durante desenvolvimento pode executar suite focada primeiro, mas a branch pronta para review deve rodar a suite exigida no card.

## 4. Teste de migration

Task com migration precisa validar duas rotas:

### Fresh database

```text
DB vazia
→ migrations 0000..latest
→ seed mínimo
→ smoke tests
```

### Upgrade

```text
cópia/snapshot compatível com baseline
→ nova migration
→ backfill
→ invariantes
→ aplicação inicia
```

Não aceitar migration que só funciona em banco vazio.

## 5. Fixture multi-tenant

Criar fixture padrão:

```text
orgA
  adminA
  employeeA
  clientA
orgB
  adminB
  employeeB
  clientB
```

Security tests recebem IDs conhecidos de B e executam com contexto A.

Cobrir SELECT, INSERT, UPDATE e DELETE/soft-delete conforme entidade.

## 6. RLS test matrix

Para cada nova tabela tenant:

- [ ] contexto correto lê/escreve;
- [ ] outro org não lê;
- [ ] outro org não atualiza;
- [ ] `WITH CHECK` rejeita insert com org diferente;
- [ ] sem contexto não vê/escreve;
- [ ] app role real não bypassa;
- [ ] owner/admin path fica restrito ao ambiente administrativo esperado.

Adicionar teste meta que lista tabelas com `organization_id` e compara com allowlist/policy matrix para reduzir risco de tabela nova sem RLS.

## 7. Financeiro

Casos mínimos:

- AR 1000 + recebimento 1000 → settled;
- AR 1000 + recebimento 300 → partial/saldo 700;
- dois recebimentos completam um título;
- uma movimentação liquida dois títulos;
- tentativa de alocar acima da movimentação falha;
- tentativa acima do saldo falha;
- concorrência não over-alloca;
- estorno reabre saldos corretamente;
- provisão realizada não duplica relatório;
- datas de competência e caixa produzem relatórios distintos.

## 8. Gráfica

Casos mínimos:

- Trabalho sem OS;
- cotação rejeitada → sourcing;
- segunda cotação aprovada;
- usuário sem permissão não aprova;
- OS registrada com documento;
- cliente pede revisão e depois aprova;
- custo aprovado não cria AP antes da contratação;
- contratação cria AP uma vez;
- aprovação comercial cria AR sem criar transação;
- multi-OS via allocation;
- waiting exige motivo/owner;
- import com dado ambíguo gera pendência e não inventa vínculo.

## 9. Acesso/Pessoas

- login sem invite não libera backoffice;
- pending/suspended/revoked bloqueados;
- session stale após revoke falha;
- sem fallback role;
- role replacement rollbacka em falha;
- last admin protegido;
- portal sem Employee vinculado bloqueia;
- own-scope não lê outro employee;
- offboarding revoga sessão/acesso.

## 10. Férias

- saldo adquirido/reservado/utilizado/vendido;
- overlap;
- cancelamento devolve reserva correta;
- concorrência de duas solicitações não cria saldo negativo;
- aprovação realmente altera ledger/saldo;
- reabertura auditada.

## 11. NF/Reembolso

- aprovação NF cria AP exatamente uma vez;
- falha na criação AP rollbacka aprovação;
- pagamento via Financeiro reflete na NF;
- reembolso direto cria AP;
- reembolso em NF não duplica AP;
- include/exclude rollbacka integralmente em falha.

## 12. Rate limiting

- limite abaixo do threshold passa;
- request limite+1 é bloqueado;
- janela expira corretamente;
- chaves de usuários diferentes são independentes;
- org/action independentes;
- duas requests concorrentes não ultrapassam contador de forma inconsistente;
- IP não é armazenado puro quando hashing for requerido.

## 13. Uploads

- MIME incompatível;
- extensão inválida;
- tamanho excessivo;
- path traversal no filename;
- download sem permissão;
- download cross-org;
- metadata existente mas objeto ausente retorna erro controlado.

## 14. E2E release suite

Fluxos mínimos:

1. auth/invite + acesso;
2. Financeiro AR → transaction → partial/full reconciliation → reversal;
3. Gráfica ponta a ponta;
4. férias;
5. NF PJ → AP → pagamento;
6. reembolso;
7. offboarding → sessão revogada + recursos pendentes;
8. documento upload/download autorizado.

## 15. Review independente

Depois que uma branch passa testes, executar revisão contra `development` antes do merge. Achados P0/P1 devem ser corrigidos ou explicitamente rejeitados com justificativa.

## 16. Definition of Done de uma task

Uma task só está pronta para review quando:

- critérios de aceite atendidos;
- testes novos existem;
- gates passam;
- migration validada quando aplicável;
- segurança revisada;
- documentação atualizada se comportamento/setup mudou;
- branch tem commit limpo;
- nenhum TODO crítico foi escondido.

`done` só após merge em `development` e revalidação de integração.
