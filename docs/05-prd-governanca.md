# 05 — PRD Governança, Recursos e Documentos

## 1. Objetivo

Refinar Equipamentos, Acessos Externos, SaaS e Documentos para suportar histórico, lifecycle, responsabilidades e integração financeira sem confundir “acesso a ferramentas” com “acesso ao ERP”.

## 2. Equipamentos

### Estado alvo

Equipamento possui inventário estável e histórico de assignments.

`equipment_assignments` deve registrar:

- equipamento;
- colaborador;
- entregue em;
- devolvido em;
- condição na entrega;
- condição na devolução;
- local;
- responsável;
- observações.

Não usar apenas sobrescrita de `employeeId` + texto em notes como histórico.

Campos adicionais de equipamento podem incluir compra, garantia, serial e status.

## 3. Acessos externos

Renomear visualmente o módulo para **Acessos externos** ou equivalente, para não confundir com acesso ao ERP.

Criar catálogo de ferramentas/plataformas. Registro deve indicar:

- ferramenta;
- colaborador;
- cliente quando aplicável;
- nível/perfil;
- concedido em;
- revisado em;
- revogado em;
- owner/responsável;
- criticidade.

Não armazenar senha em texto puro. O módulo registra existência/governança do acesso, não é password manager.

## 4. SaaS

Assinatura deve representar contrato/licença, não apenas nome+valor.

Campos alvo:

- fornecedor;
- produto/plano;
- periodicidade;
- moeda;
- quantidade de licenças contratadas;
- licenças atribuídas;
- início;
- renovação/cancelamento;
- responsável;
- centro de custo;
- cliente associado opcional;
- criticidade;
- documento contratual;
- valor/condição.

Usuários vinculados não devem ser usados como substituto da capacidade contratada.

Integração financeira posterior pode gerar provisão/AP, sem duplicar obrigação já existente.

## 5. Documentos

Infraestrutura de arquivo/documento deve aceitar owners adicionais:

- client;
- graphic_job;
- supplier;
- receivable/payable;
- financial_transaction;
- saas_subscription;
- access_record;
- equipment/assignment;
- entidades já suportadas.

Upload continua com validação de MIME/extensão/tamanho/checksum e storage privado.

Leitura de documento sensível deve ser auditável.

## 6. Retenção

Política de retenção ainda precisa de decisão de negócio. Até lá:

- não apagar automaticamente documento sensível sem política;
- soft-delete/metadata de deleção quando aplicável;
- storage orphan cleanup somente após verificação de referência;
- documentar restore e lifecycle do objeto.

## 7. Lifecycle

Desligamento deve consultar:

- equipment assignments abertos;
- access records ativos;
- licenças SaaS vinculadas;
- documentos/pendências necessárias.

O sistema gera work items, não apenas alerta textual.

## 8. Tasks

### EQP-001 — Histórico de assignments

**P1** — depende `SEC-003`, `CORE-001`
Branch: `feature/equipment-assignment-history`

### EQP-002 — Condição/local/garantia

**P2** — depende `EQP-001`
Branch: `feature/equipment-metadata-v2`

### EQP-003 — Integração lifecycle

**P1** — depende `EQP-001`, `CORE-004`
Branch: `feature/equipment-lifecycle-work-items`

### EXT-001 — Catálogo de ferramentas

**P1** — depende `SEC-003`
Branch: `feature/external-tools-catalog`

### EXT-002 — Histórico/revisão de acesso externo

**P1** — depende `EXT-001`, `CORE-004`
Branch: `feature/external-access-lifecycle`

### EXT-003 — Segurança e nomenclatura

**P1** — depende `EXT-002`
Branch: `fix/external-access-security-copy`

- renomear UI;
- validar que terminated/deleted employee não recebe novo acesso sem override explícito;
- testes.

### SAA-001 — Modelo SaaS v2

**P1** — depende `FIN-002`, `SEC-003`
Branch: `feature/saas-model-v2`

### SAA-002 — Seats e assignments

**P1** — depende `SAA-001`
Branch: `feature/saas-seat-management`

### SAA-003 — Renovação/pendências

**P1** — depende `SAA-001`, `CORE-004`
Branch: `feature/saas-renewal-work-items`

### SAA-004 — Integração financeira opcional

**P2** — depende `FIN-007`, `SAA-001`
Branch: `feature/saas-finance-integration`

### DOC-001 — Generalizar owner types

**P0** — depende `SEC-003`
Branch: `feature/documents-owner-v2`

### DOC-002 — Helper de anexos por domínio

**P0** — depende `DOC-001`, `CORE-001`
Branch: `feature/document-attachments-contract`

### DOC-003 — Retenção e orphan safety

**P2** — depende decisão em `docs/decisions/`
Branch: `feature/document-retention`

### DOC-004 — Security tests de download

**P0 release gate** — depende `DOC-001`
Branch: `test/document-access-security`

## 9. Critérios globais

- [ ] assignments de equipamento são consultáveis historicamente;
- [ ] “Acessos externos” não se confunde com usuários/RBAC;
- [ ] não há armazenamento de senha em texto;
- [ ] SaaS distingue seats contratados de vínculos;
- [ ] documentos suportam Gráfica/Financeiro;
- [ ] downloads cross-org/IDOR falham;
- [ ] lifecycle gera pendências acionáveis.
