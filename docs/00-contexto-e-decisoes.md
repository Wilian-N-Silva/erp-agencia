# 00 — Contexto, decisões e glossário

## 1. Objetivo do ciclo v2

Evoluir o Sistema Interno FG de um conjunto de módulos já funcionais para um ERP operacional confiável para a agência, sem reescrever do zero e sem interromper os fluxos atuais desnecessariamente.

O ciclo v2 prioriza três eixos:

1. **segurança e isolamento reais**: autorização coerente, RLS, validação, rate limiting, sessões e auditoria;
2. **financeiro confiável**: separar obrigação de receber/pagar de movimentação de caixa, permitir liquidação parcial e conciliação;
3. **módulo exclusivo da Gráfica**: reproduzir o fluxo real do departamento e integrar seus fatos financeiros ao Financeiro geral.

## 2. Não é reescrita

Decisão: preservar Next.js, React, Drizzle, Better Auth, Postgres, R2, design system e organização geral por features. Mudanças serão incrementais, com migrations aditivas e compatibilidade temporária quando necessário.

Não criar um novo ERP paralelo.

## 3. Linguagem do produto

### OS da Gráfica

Na Formula Group, a equipe chama de **OS** o documento que o software externo imprime formalmente como **Orçamento**. A interface do ERP deve usar **OS**, porque essa é a linguagem operacional da equipe.

Tecnicamente, o domínio não deve presumir que a entidade central é a OS. O objeto central é o **Trabalho da Gráfica**, que nasce antes do documento externo.

### Trabalho da Gráfica

Registro interno do ERP que acompanha a demanda desde a busca de fornecedor até encerramento e resultado financeiro.

Código sugerido: `GR-AAAA-NNNNN`.

### Cotação de fornecedor

Proposta/custo obtido pela funcionária da Gráfica antes da geração da OS.

### Aprovação interna

Aprovação **da cotação/fornecedor**, feita por Saulo e/ou Jaci. Não é aprovação interna da OS nem do trabalho.

Fluxo:

```text
Procura fornecedor
→ registra cotação
→ Saulo/Jaci aprova ou rejeita
→ se rejeitado, procura outro fornecedor
→ se aprovado, gera a OS no software externo
```

### Aprovação do cliente

Ocorre depois que a OS foi gerada e apresentada ao cliente. É independente da aprovação interna do fornecedor.

## 4. Fluxo macro da Gráfica

```text
Demanda
  → busca/cotação de fornecedor
  → aprovação interna do fornecedor
  → registro da OS externa
  → aprovação do cliente
  → liberação/contratação do fornecedor
  → produção
  → pronto/entrega
  → liquidação financeira
  → encerramento
```

Fornecedor rejeitado não encerra o Trabalho: retorna para busca de fornecedor.

## 5. Integração financeira

Não haverá “financeiro da Gráfica” separado no banco.

As telas de Entradas/Saídas dentro da Gráfica serão visões filtradas do Financeiro geral.

Regra central:

> O departamento registra o fato operacional; o Financeiro confirma o fato financeiro.

Exemplos:

- Gráfica registra custo contratado → nasce/é vinculada uma Conta a Pagar.
- Cliente aprova trabalho e condição comercial → nasce/é vinculada uma Conta a Receber.
- Financeiro confirma pagamento/recebimento → nasce uma Movimentação e sua alocação.

## 6. Contas a receber, contas a pagar e caixa

Decisão semântica:

- `financial_entries` atuais representam **Contas a Receber**, não “dinheiro que entrou”.
- `financial_expenses` atuais representam **Contas a Pagar**, não “dinheiro que saiu”.
- Dinheiro efetivamente movimentado será representado por `financial_transactions`.

Isso permite parcelamento, liquidação parcial, conciliação e relatórios de competência/caixa coerentes.

## 7. Clientes

Cliente não é sinônimo de contrato mensal/fee. Perfil de cobrança recorrente é opcional.

## 8. Pessoas e acesso

Decisão de segurança:

> Autenticar não significa estar autorizado.

Login Google de domínio permitido não deve conceder acesso de negócio automaticamente.

O sistema deve possuir pré-autorização/convite, vínculo explícito `User ↔ Employee` quando aplicável, roles reais e status de acesso (`pending`, `active`, `suspended`, `revoked`).

## 9. RLS

RLS passa a ser requisito obrigatório para tabelas de negócio multi-tenant. O sistema continua validando `organizationId` no DAL, mas Postgres deve funcionar como segunda barreira.

Tabelas de autenticação que precisam operar antes de existir contexto de organização serão classificadas explicitamente em `06-security-and-rls.md` e não devem receber uma policy genérica que quebre o Better Auth.

## 10. Rate limiting

Rate limiting de login da biblioteca de autenticação não é suficiente para o ERP inteiro. Ações sensíveis autenticadas terão limite distribuído/persistente, com configuração por tipo de ação.

## 11. Histórico e correção

Entidades com estado devem ter transições explícitas. Correções sensíveis devem usar operações semânticas (`cancelar`, `reabrir`, `estornar`, `restaurar`) em vez de apagar fatos concluídos.

## 12. Projetos/eventos

Cafu Camp e casos futuros são **Projetos/Eventos**, não colunas especiais e não tabelas financeiras específicas.

## 13. Escopo v2

Incluído:

- segurança/acesso/RLS;
- financeiro v2;
- Gráfica;
- clientes;
- férias;
- lifecycle;
- NF PJ e reembolso integrados ao Financeiro;
- equipamentos, acessos externos, SaaS e documentos refinados;
- pendências e dashboard orientado a ação;
- migrations e rollout incremental.

Fora do escopo por padrão:

- substituir o software de orçamento/OS da Gráfica;
- emissão automática de NF;
- contabilidade/fiscal completo;
- folha de pagamento;
- conciliação bancária via Open Finance;
- ERP industrial/MRP de produção gráfica;
- chat interno.
