# Manual do Sistema Interno FG

Versão: **1.0** — última revisão 2026-05-22.

Este manual descreve como usar o sistema no dia a dia. Está organizado por
perfil de acesso e por módulo. Se você não encontrar o que precisa, peça
ajuda ao seu gestor ou ao time de TI.

> **Onde acessar:** o endereço de produção será confirmado antes do
> lançamento. Em ambiente de homologação, o sistema fica em
> `http://localhost:3000` (rodando local) ou no domínio definido pelo time
> de infra.

---

## Sumário

1. [Como entrar (login)](#1-como-entrar-login)
2. [Perfis de acesso](#2-perfis-de-acesso)
3. [Tour pela interface](#3-tour-pela-interface)
4. [Portal do Colaborador](#4-portal-do-colaborador)
5. [Back-office por módulo](#5-back-office-por-módulo)
6. [Fluxos do dia a dia](#6-fluxos-do-dia-a-dia)
7. [Dúvidas frequentes](#7-dúvidas-frequentes)

---

## 1. Como entrar (login)

1. Abra o sistema no navegador.
2. Clique em **Entrar com Google** e selecione sua conta corporativa.
3. O acesso só é liberado para contas do domínio autorizado pela empresa.
4. Após o login, o sistema decide automaticamente entre:
   - **Back-office** (`/app`) — quando você tem papel administrativo ou
     operacional.
   - **Portal do Colaborador** (`/portal`) — quando você é apenas
     colaborador.

> Se você for **PJ** (Pessoa Jurídica), o portal mostra a aba **NFs**. Se
> for **CLT**, o portal mostra **Férias** com o saldo do período aquisitivo.

---

## 2. Perfis de acesso

O sistema tem 7 papéis. Cada pessoa pode ter um ou mais.

| Papel | O que pode fazer |
|---|---|
| **Admin Técnico** | Configurações, papéis e permissões |
| **Diretoria** | Tudo, exceto configurações técnicas |
| **Financeiro** | Entradas, saídas, provisões, aprovação de NFs PJ e reembolsos, exportações |
| **RH/Admin** | Colaboradores, admissões, desligamentos, férias, documentos sensíveis, saldo de férias |
| **TI/Governança** | Equipamentos, acessos, assinaturas SaaS |
| **Liderança** | Vê dados do próprio time, aprova reembolsos e férias do time |
| **Colaborador** | Apenas o Portal — seus próprios dados |

> **Cada permissão é validada três vezes**: no menu (oculta o que você não
> pode ver), na entrada da página (redireciona para *acesso negado*) e no
> banco (impede leitura/escrita indevida).

---

## 3. Tour pela interface

### Back-office

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo FG]      [Barra de busca · ⌘K]            [Usuário] │  ← Header
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Operação    │   Conteúdo da página                         │
│  Financeiro  │                                              │
│  Pessoas     │                                              │
│  Fluxos      │                                              │
│  TI          │                                              │
│  Admin       │                                              │
│              │                                              │
│  [Tema]      │                                              │
│  [Sair]      │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **Sidebar à esquerda**: navegação agrupada em seções. Apenas os itens
  que seu perfil enxerga aparecem.
- **Header**: busca rápida (atalho `Ctrl+K` ou `⌘K`) e dropdown do usuário
  (tema claro/escuro, sair).
- **Conteúdo**: cada página tem um `PageHeader` com título, descrição e
  ações principais à direita.
- **Tabelas**: filtros e ordenação no topo, paginação no rodapé. Clique em
  qualquer linha para abrir a sheet de detalhe.

### Portal do Colaborador

Layout próprio, mais respirado, centralizado em 960 px.

```
┌──────────────────────────────────────────────────────────┐
│  [Logo FG]   Início NFs Reembolsos Férias …  [Usuário]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│       Bom dia, [Nome].                                   │
│       Hoje é segunda-feira, 22 de maio.                  │
│                                                          │
│       ╔════════════════════════════════════════╗         │
│       ║  AÇÃO REQUERIDA · NF de maio/26       ║  ← Card  │
│       ║  Prazo: 25/05 · faltam 3 dias          ║  laranja│
│       ║  Valor esperado: R$ 8.450,00           ║         │
│       ║  [Ver composição e enviar NF →]        ║         │
│       ╚════════════════════════════════════════╝         │
│                                                          │
│       [3 Reembolsos]  [12 dias férias]  [2 equipamentos] │
│                                                          │
│       Avisos recentes                                    │
│       • Sua NF de abril foi aprovada · 12 mai            │
│       …                                                  │
└──────────────────────────────────────────────────────────┘
```

No mobile, a navegação aparece como uma barra inferior fixa.

---

## 4. Portal do Colaborador

Acesse em `/portal`. Tudo aqui é **só seus próprios dados**.

### 4.1 Início

- Saudação personalizada (Bom dia / Boa tarde / Boa noite).
- **Card laranja de NF**: aparece apenas se você é PJ e tem uma NF aberta.
  Mostra competência, prazo e valor esperado.
- **3 cards rápidos**:
  - Reembolsos em andamento → leva para `/portal/reembolsos`.
  - Férias disponíveis (CLT) ou próxima ausência → leva para `/portal/ferias`.
  - Equipamentos atribuídos → leva para `/portal/equipamentos`.
- **Avisos recentes**: NFs aprovadas, reembolsos avançando de etapa, etc.

### 4.2 NFs (apenas PJ)

Mostra a NF da competência atual e o histórico.

**Para emitir uma NF:**

1. Confira a **composição esperada** (base + transporte + ajuda + reembolsos
   aprovados + outros − descontos). Esse é o valor que sua NF deve ter.
2. Copie o **descritivo sugerido** e cole no campo de descrição da sua NF.
3. Emita a NF no portal do município/prestador.
4. Volte ao sistema:
   - **Arquivo da NF (PDF)** — anexe o PDF gerado.
   - **Valor emitido** — preencha em reais (campo já vem com o valor
     esperado preenchido).
5. Clique em **Enviar NF para aprovação**.

> Se houver divergência maior que R$ 1,00 entre esperado e emitido, o
> financeiro vai marcar como **divergente** na aprovação. Pequenas
> diferenças são toleradas automaticamente.

### 4.3 Reembolsos

Lista todas as suas solicitações com o status (Aguardando, Em revisão,
Aprovado, Pago, Recusado).

**Para solicitar um reembolso:**

1. Clique em **Solicitar reembolso** (canto superior direito ou via card
   vazio).
2. Preencha:
   - **Descrição** — exemplo claro do gasto.
   - **Categoria** — uma das 11 categorias padrão.
   - **Valor** — em reais, com vírgula decimal (`R$ 87,40`).
   - **Data da despesa**.
   - **Comprovante** — PDF ou imagem (até 10 MB).
   - **Observações** (opcional).
3. Clique em **Enviar para aprovação**.

O fluxo de aprovação é:

```
Enviado → Aprovação do gestor → Aprovação do financeiro → Pago
```

PJs aprovados pelo financeiro podem ser **incluídos na NF** do mês.

### 4.4 Férias

- **Para CLT**: card grande mostra os dias disponíveis no período
  aquisitivo, com avisos se o saldo está perto de vencer.
- **Para todos**: lista de solicitações anteriores.

**Para solicitar férias ou pausa:**

1. Clique em **Solicitar férias** ou **Programar ausência**.
2. Selecione tipo: Férias, Pausa programada ou Ausência programada.
3. Preencha início e fim.
4. Adicione uma observação se for relevante.
5. Envie. Seu gestor recebe para aprovar.

### 4.5 Documentos

Lista de documentos disponíveis para você (contracheques, contratos,
recibos, etc.). Clique no ícone de download para baixar.

### 4.6 Equipamentos

Cards com os equipamentos sob sua responsabilidade (notebook, monitor,
celular, etc.). Mostra patrimônio, número de série, status.

### 4.7 Acessos

Lista das ferramentas que você tem acesso (Slack, Figma, Google Workspace,
etc.) com nível de acesso e indicação visual quando o acesso é **crítico**.

### 4.8 Meus dados

Identificação básica (nome, matrícula, cargo, área, vínculo). Para
atualizar dados pessoais, fale com o RH.

---

## 5. Back-office por módulo

Acesse em `/app`. O que cada perfil enxerga depende das permissões.

### 5.1 Dashboard (`/app`)

Visão geral da operação:

- **KPIs financeiros** — receita prevista x recebida, despesas, provisões
  do mês.
- **Alerta de pagamentos críticos** — entradas atrasadas ou em risco.
- **Eventos próximos** — aniversários e prazos importantes nos próximos dias.
- **Mini-tabelas** — A receber (próximos 7 dias), A pagar (próximos 7
  dias), NFs pendentes, Reembolsos pendentes.

### 5.2 Alertas (`/app/alertas`)

Centraliza alertas operacionais: licenças de SaaS atribuídas a desligados,
equipamentos não devolvidos, acessos críticos pendentes, férias prestes a
vencer, etc.

### 5.3 Financeiro

Três rotas que compartilham a mesma interface:

- **`/app/financeiro/entradas`** — receitas previstas e recebidas.
- **`/app/financeiro/saidas`** — despesas e fornecedores.
- **`/app/financeiro/provisoes`** — gastos recorrentes (SaaS, salários
  fixos, etc.) com valor anualizado e próxima previsão.

Cada lançamento abre uma **sheet** para criar/editar com campos: valor,
vencimento, competência, status, cliente / centro de custo, observações.

**Ações por linha**: marcar como recebido / pago, editar, cancelar.

**Exportar**: CSV ou XLSX no canto superior direito (respeita os filtros
ativos).

### 5.4 Clientes (`/app/clientes`)

Lista com filtros por status, owner, status financeiro do mês.

**Detalhe do cliente (6 abas):**

1. Resumo
2. Lançamentos
3. Cobrança (perfil de cobrança: fee mensal, dia de vencimento, vigência)
4. NFs emitidas
5. Reembolsos atribuídos
6. Histórico

**Para criar um cliente**: botão **Novo cliente** no topo da lista.

### 5.5 Colaboradores

**Lista (`/app/colaboradores`)** — matrícula, nome, área, vínculo, status,
entrada, gestor, tempo de casa. Exportar CSV à direita.

**Detalhe (`/app/colaboradores/[id]`) — 11 abas:**

1. Resumo
2. Dados pessoais
3. Vínculo e cargo
4. Remuneração (histórico de alterações)
5. Férias / Pausas
6. Equipamentos
7. Acessos
8. NFs
9. Reembolsos
10. Histórico (audit log)
11. (a próxima aba conforme escopo)

Dados sensíveis (CPF, conta bancária, salário) ficam ocultos para perfis
sem `documents.read_sensitive` ou `people.read_compensation`.

### 5.6 Admissões e Desligamentos

Listas em `/app/colaboradores/admissoes` e `/app/colaboradores/desligamentos`.

**Cards compactos** mostram: nome, cargo, área, vínculo, data prevista,
responsável, barra de progresso (X de Y itens concluídos, bloqueios em
vermelho).

**Clique em "Abrir checklist"** para o detalhe — lista de itens com:

- Marcador visual por status (concluído, pendente, bloqueado, N/A).
- Responsável (avatar + nome).
- Ações por item: **Marcar concluído**, **Bloquear**, **N/A**.

**Para iniciar uma admissão**: botão **Iniciar admissão** abre a sheet com
o formulário completo do novo colaborador. O checklist padrão é criado
automaticamente.

**Para abrir um desligamento**: botão **Abrir desligamento** abre a sheet
para selecionar o colaborador e definir o prazo final.

### 5.7 Férias e ausências (`/app/ferias`)

**Duas visões:**

- **Lista** — tabela com colaborador, tipo, vínculo, período, dias úteis,
  status, aprovador.
- **Calendário** — visão mensal com lanes coloridas por tipo (Férias CLT,
  Pausa PJ, Afastamento).

**Aprovar / Recusar**: ações em cada linha (para gestores e RH).

### 5.8 NFs PJ (`/app/nfs`)

Lista com abas por status: Aguardando envio, Em conferência, Divergentes,
Aprovadas, Pagas, Encerradas.

**Para criar uma composição** (financeiro):

1. Clique em **Nova composição**.
2. Selecione o colaborador PJ.
3. Defina competência e prazo de envio.
4. Preencha base, transporte, ajuda de custo, reembolsos, outros, descontos.
5. Adicione descritivo sugerido (opcional — gerado automaticamente).
6. **Publicar solicitação** — o PJ recebe no portal dele.

**Para revisar uma NF enviada**:

1. Abra a sheet de detalhe.
2. Confira a composição esperada vs. valor emitido.
3. Veja o PDF anexado.
4. Aprovar, Pedir ajuste, ou Recusar (botões no rodapé).
5. Quando aprovada, o botão **Marcar pago** aparece.

### 5.9 Reembolsos (`/app/reembolsos`)

Lista com abas: Aguardando aprovação, Em revisão, Aprovados, Recusados,
Pagos.

**Detalhe do reembolso** (sheet de 2 colunas):

- Esquerda: preview do anexo + ações (Abrir, Baixar).
- Direita: dados do solicitante + **timeline de aprovação** (gestor →
  financeiro → pago).

**Ações** (dependendo do perfil e do status):

- Gestor: Aprovar / Recusar.
- Financeiro: Aprovar para pagamento / Recusar.
- Marcar pago.
- **Incluir em NF**: se PJ e aprovado pelo financeiro, soma na composição
  da NF do mês.

### 5.10 Equipamentos (`/app/equipamentos`)

Lista de patrimônio (notebooks, monitores, celulares, etc.) com
colaborador atribuído, status, alertas de devolução.

### 5.11 Acessos (`/app/acessos`)

Registros de quem tem acesso a quê. Marca acessos **críticos** e os
**vencidos para revisão**.

### 5.12 Assinaturas SaaS (`/app/assinaturas`)

Duas visões: **Cards** (visual) ou **Lista** (densa).

**KPIs**: custo mensal, custo anualizado, renovações nos próximos 14 dias,
assinaturas com alerta (licenças ocupadas por desligados).

**Detalhe (4 abas):**

1. Resumo (KPIs por assinatura)
2. Usuários vinculados (com alerta vermelho para desligados que ainda têm
   licença ativa)
3. Renovações (histórico + próxima)
4. Contrato

### 5.13 Documentos (`/app/documentos`)

Cofre de documentos. Permissão para ver depende da sensibilidade do
arquivo (público, restrito, sensível, altamente sensível).

### 5.14 Auditoria (`/app/auditoria`)

Histórico imutável de todas as ações no sistema. Filtros por usuário,
entidade, período, ação. Exportar CSV / XLSX.

### 5.15 Configurações (`/app/configuracoes`)

Apenas para Admin Técnico. Gerencia papéis, permissões customizadas, etc.

---

## 6. Fluxos do dia a dia

### Fluxo 1 — PJ enviando NF mensal

```
1. Financeiro cria a composição em /app/nfs    ╲
2. PJ recebe notificação no portal /portal/nfs  ╲   3 dias antes
3. PJ emite NF no município                      ▸ do prazo
4. PJ anexa PDF + valor emitido no portal       ╱
5. Financeiro revisa em /app/nfs                ╱
6. Financeiro aprova → marca pago
```

### Fluxo 2 — Reembolso

```
1. Colaborador solicita em /portal/reembolsos
2. Gestor aprova em /app/reembolsos (visão filtrada para o time)
3. Financeiro aprova para pagamento
4. (PJ) Incluído na NF do mês OU pago direto
5. Financeiro marca pago
```

### Fluxo 3 — Admissão de CLT

```
1. RH em /app/colaboradores/admissoes
2. Clica "Iniciar admissão" → cadastra colaborador + checklist
3. RH/Gestor/TI executam os itens do checklist
4. Quando todos itens obrigatórios concluídos → "Concluir admissão"
```

### Fluxo 4 — Desligamento

```
1. RH/Gestor em /app/colaboradores/desligamentos
2. Clica "Abrir desligamento" → seleciona colaborador
3. Checklist criado: devolver equipamento, revogar acessos, pagar pendências
4. Alerta vermelho aparece se há equipamento atribuído ou reembolso aberto
5. "Concluir desligamento" desativa acessos e altera status do colaborador
```

### Fluxo 5 — Férias (CLT)

```
1. Colaborador vê saldo em /portal/ferias
2. Solicita período em "Solicitar férias"
3. Gestor aprova em /app/ferias
4. Saldo é debitado automaticamente quando aprovado
5. Alertas avisam quando o período aquisitivo está perto de vencer
```

---

## 7. Dúvidas frequentes

**Esqueci minha senha. Como recupero?**
> O login é via Google corporativo. Recupere a senha pelo Google diretamente.

**Não estou vendo um módulo no menu. Por quê?**
> Seu perfil não tem permissão para ele. Fale com o gestor ou TI se isso
> for um engano.

**O sistema acusou que minha NF está divergente.**
> O valor emitido ficou mais de R$ 1,00 acima ou abaixo do esperado.
> Confira a composição com o financeiro antes de reemitir.

**Tentei incluir um reembolso na NF e não apareceu a opção.**
> O reembolso precisa estar **Aprovado pelo financeiro** e ainda **não
> incluído** em outra NF para aparecer na lista de elegíveis.

**O calendário de férias mostra todos os colaboradores. É normal?**
> Sim. A visão global ajuda gestores e RH a detectar conflitos de
> sobreposição por área.

**Como mudo entre tema claro e escuro?**
> No back-office: dropdown do usuário (canto inferior da sidebar). No
> portal: ícone de lua/sol no header.

**Posso usar o sistema no celular?**
> Sim, mas a experiência do portal é otimizada para celular. O back-office
> funciona melhor em telas grandes (tabela, sheets laterais, calendário).

**Quem aprova o quê?**

| Item | Aprovador |
|---|---|
| Reembolso (etapa 1) | Gestor direto do colaborador |
| Reembolso (etapa 2) | Financeiro |
| Férias / pausas | Gestor direto |
| NF PJ | Financeiro |
| Admissão concluída | Após todos itens obrigatórios do checklist |
| Desligamento concluído | Após todos itens obrigatórios do checklist |

---

> **Última observação**: este manual reflete o sistema na versão **1.0**.
> Recursos podem ter sido adicionados ou ajustados em versões posteriores
> — consulte o `docs/launch-checklist-v1.md` para o estado mais recente do
> projeto.
