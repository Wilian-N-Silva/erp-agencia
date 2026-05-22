// Cliente — billing profiles, documentos, timeline.

const _d3 = (dia, mes, ano = 2026) => new Date(ano, mes, dia);

// ────────────────────────────────────────────────────────────────────────────
// Datas de início (cliente desde)
// ────────────────────────────────────────────────────────────────────────────
window.FG_CLIENTES_INICIO = {
  "cli-001": _d3(15, 2, 2024),
  "cli-002": _d3(1, 5, 2024),
  "cli-003": _d3(3, 0, 2023),
  "cli-004": _d3(10, 7, 2024),
  "cli-005": _d3(20, 10, 2023),
  "cli-006": _d3(5, 1, 2025),
  "cli-007": _d3(12, 4, 2021),
  "cli-008": _d3(8, 3, 2023),
};

// ────────────────────────────────────────────────────────────────────────────
// Billing profiles (perfis de cobrança)
// ────────────────────────────────────────────────────────────────────────────
window.FG_BILLING = {
  "cli-001": { metodo: "PIX", prazo: 5, recorrencia: "Mensal", contato: { nome: "Patrícia Holanda", email: "patricia.h@boavistacosmeticos.com.br", telefone: "(11) 9 8765-4321" }, lembreteAntes: { ativo: true, dias: 3 }, lembreteApos: { ativo: true, dias: 2 }, obs: "Cliente prefere PIX; nota fiscal de serviço enviada por e-mail no 1º dia útil de cada mês.", autoGerar: true },
  "cli-002": { metodo: "TED", prazo: 7, recorrencia: "Mensal", contato: { nome: "André Lemos", email: "andre.lemos@riacho.com.br", telefone: "(11) 9 8123-4567" }, lembreteAntes: { ativo: true, dias: 5 }, lembreteApos: { ativo: false, dias: 0 }, obs: "Envia NF em PDF antes do dia 5.", autoGerar: true },
  "cli-003": { metodo: "Boleto", prazo: 10, recorrencia: "Mensal", contato: { nome: "Bruno Sales", email: "bruno@ventosulmobilidade.com", telefone: "(11) 9 9876-1234" }, lembreteAntes: { ativo: true, dias: 7 }, lembreteApos: { ativo: true, dias: 3 }, obs: "Histórico de atrasos — solicitar boleto com 10 dias de antecedência.", autoGerar: true },
  "cli-004": { metodo: "PIX", prazo: 3, recorrencia: "Mensal", contato: { nome: "Camila Forte", email: "financeiro@cestapronta.com.br", telefone: "(11) 9 7654-3210" }, lembreteAntes: { ativo: false, dias: 0 }, lembreteApos: { ativo: false, dias: 0 }, obs: "Pagamento sempre no dia 5, sem necessidade de cobrança ativa.", autoGerar: true },
  "cli-005": { metodo: "TED", prazo: 5, recorrencia: "Mensal", contato: { nome: "Eduarda Lin", email: "edu.lin@novaroma.com.br", telefone: "(11) 9 8888-2222" }, lembreteAntes: { ativo: true, dias: 3 }, lembreteApos: { ativo: true, dias: 5 }, obs: "Equipe financeira responde em até 48h.", autoGerar: true },
  "cli-006": { metodo: "PIX", prazo: 2, recorrencia: "Bimestral", contato: { nome: "Gustavo Pernambuco", email: "gpernambuco@sertaobebidas.com.br", telefone: "(81) 9 5555-1234" }, lembreteAntes: { ativo: true, dias: 5 }, lembreteApos: { ativo: true, dias: 3 }, obs: "Cobrança bimestral com parcelamento em duas vezes — primeira no dia 1, segunda no dia 16.", autoGerar: true },
  "cli-007": { metodo: "TED", prazo: 10, recorrencia: "Mensal", contato: { nome: "Heloísa Andrade", email: "heloisa.a@pampulhabank.com.br", telefone: "(11) 9 4444-5555" }, lembreteAntes: { ativo: true, dias: 7 }, lembreteApos: { ativo: false, dias: 0 }, obs: "Cliente estratégico — sem cobrança após o vencimento; canal direto com a Helena.", autoGerar: true },
  "cli-008": { metodo: "PIX", prazo: 5, recorrencia: "Mensal", contato: { nome: "Marcos Linhares", email: "marcos@linhares.edu.br", telefone: "(11) 9 3333-4444" }, lembreteAntes: { ativo: false, dias: 0 }, lembreteApos: { ativo: false, dias: 0 }, obs: "Cliente em pausa — relação será revisada em jul/26.", autoGerar: false },
};

// ────────────────────────────────────────────────────────────────────────────
// Documentos por cliente
// ────────────────────────────────────────────────────────────────────────────
window.FG_DOCS_CLIENTE = {
  "cli-001": [
    { id: "doc-1", tipo: "Contrato", nome: "Contrato fee Boa Vista 2024.pdf", versao: 2, sensivel: false, enviadoPor: "Lívia Câmara", em: _d3(15, 0, 2025) },
    { id: "doc-2", tipo: "Adendo", nome: "Adendo reajuste IPCA mar-2025.pdf", versao: 1, sensivel: false, enviadoPor: "Lívia Câmara", em: _d3(28, 2, 2025) },
    { id: "doc-3", tipo: "Briefing", nome: "Briefing campanha Inverno 26.pdf", versao: 1, sensivel: false, enviadoPor: "Marina Toledo", em: _d3(2, 3, 2026) },
  ],
  "cli-007": [
    { id: "doc-4", tipo: "Contrato", nome: "Contrato master Pampulha Banking.pdf", versao: 3, sensivel: true, enviadoPor: "Helena Vasconcelos", em: _d3(12, 4, 2021) },
    { id: "doc-5", tipo: "Aditivo", nome: "Aditivo escopo projeto Onboarding App.pdf", versao: 1, sensivel: false, enviadoPor: "Helena Vasconcelos", em: _d3(15, 3, 2026) },
    { id: "doc-6", tipo: "NDA", nome: "NDA atualizado 2025.pdf", versao: 2, sensivel: true, enviadoPor: "Lívia Câmara", em: _d3(20, 7, 2025) },
  ],
  "cli-003": [
    { id: "doc-7", tipo: "Contrato", nome: "Contrato Vento Sul 2023.pdf", versao: 1, sensivel: false, enviadoPor: "Lívia Câmara", em: _d3(3, 0, 2023) },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Timeline de eventos por cliente
// ────────────────────────────────────────────────────────────────────────────
window.FG_TIMELINE_CLIENTE = {
  "cli-001": [
    { tipo: "pagamento", titulo: "Fee mai/26 recebido — R$ 48.000,00", ator: "Lívia Câmara (financeiro)", em: _d3(5, 4) },
    { tipo: "fee_reajuste", titulo: "Reajuste IPCA aplicado — R$ 45.500 → R$ 48.000", ator: "Lívia Câmara", em: _d3(1, 2) },
    { tipo: "pagamento", titulo: "Fee fev/26 recebido — R$ 45.500,00", ator: "sistema", em: _d3(7, 1) },
    { tipo: "contrato", titulo: "Contrato renovado por mais 24 meses", ator: "Helena Vasconcelos", em: _d3(15, 0, 2025) },
    { tipo: "criado", titulo: "Cliente criado no sistema", ator: "Lívia Câmara", em: _d3(15, 2, 2024) },
  ],
  "cli-003": [
    { tipo: "atraso", titulo: "Fee mai/26 em atraso há 6 dias — R$ 65.000,00 pendente", ator: "sistema", em: _d3(16, 4) },
    { tipo: "cobranca", titulo: "Cobrança enviada — segunda tentativa", ator: "Lívia Câmara", em: _d3(20, 4) },
    { tipo: "pagamento", titulo: "Fee abr/26 recebido com 3 dias de atraso — R$ 65.000,00", ator: "Lívia Câmara", em: _d3(18, 3) },
    { tipo: "criado", titulo: "Cliente criado no sistema", ator: "Helena Vasconcelos", em: _d3(3, 0, 2023) },
  ],
  "cli-007": [
    { tipo: "projeto", titulo: "Projeto Onboarding App contratado — R$ 180.000 (parcela única mai/26)", ator: "Helena Vasconcelos", em: _d3(15, 3) },
    { tipo: "pagamento", titulo: "Fee mai/26 recebido — R$ 95.000,00", ator: "sistema", em: _d3(9, 4) },
    { tipo: "pagamento", titulo: "Fee abr/26 recebido — R$ 95.000,00", ator: "sistema", em: _d3(10, 3) },
    { tipo: "criado", titulo: "Cliente criado no sistema", ator: "Helena Vasconcelos", em: _d3(12, 4, 2021) },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// Observações internas
// ────────────────────────────────────────────────────────────────────────────
window.FG_OBS_CLIENTE = {
  "cli-001": "Cliente sólido. Patrícia (financeiro deles) é eficiente e responde no mesmo dia. Pagamento sempre no prazo via PIX. Bom potencial para upsell de mídia paga em Q3/26.",
  "cli-003": "Atenção: histórico recorrente de atrasos desde set/25. Bruno (financeiro) é difícil de localizar. Considerar revisão do contrato no próximo ciclo — eventualmente migrar para PIX com desconto.",
  "cli-007": "Cliente estratégico, conta com a Helena diretamente. NDA atualizado em jul/25. Projeto Onboarding App em andamento — escopo finalizado em abr/26.",
};
