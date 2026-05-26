// Extended mock data — colaboradores, NFs, reembolsos, férias, admissões.
// Continua FG_TODAY = 21/05/2026.

const _d2 = (dia, mes = 4, ano = 2026) => new Date(ano, mes, dia);

// ────────────────────────────────────────────────────────────────────────────
// Colaboradores (28 ativos + alguns desligados/em aviso)
// ────────────────────────────────────────────────────────────────────────────
window.FG_COLABORADORES = [
  // Diretoria / Liderança
  { id: "c-001", matricula: "FG-00001", nome: "Helena Vasconcelos", cargo: "Diretora Executiva", area: "Diretoria", vinculo: "Sócia", gestor: null, status: "ativo", entrada: _d2(15, 1, 2019), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 38000, ajudaCusto: 0, transporte: 0, ferias: { dias: 20, vencimento: _d2(15, 0, 2027) } },
  { id: "c-002", matricula: "FG-00003", nome: "Marina Toledo", cargo: "Head de Atendimento", area: "Atendimento", vinculo: "CLT", gestor: "Helena Vasconcelos", status: "ativo", entrada: _d2(10, 5, 2020), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 22500, ajudaCusto: 850, transporte: 0, ferias: { dias: 18, vencimento: _d2(10, 10, 2026) } },
  { id: "c-003", matricula: "FG-00007", nome: "Rafael Aguiar", cargo: "Head de Criação", area: "Criação", vinculo: "CLT", gestor: "Helena Vasconcelos", status: "ativo", entrada: _d2(1, 2, 2021), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 24000, ajudaCusto: 850, transporte: 0, ferias: { dias: 12, vencimento: _d2(1, 7, 2026), atencao: true } },
  { id: "c-004", matricula: "FG-00009", nome: "Júlia Bernardes", cargo: "Head de Estratégia", area: "Estratégia", vinculo: "CLT", gestor: "Helena Vasconcelos", status: "ativo", entrada: _d2(3, 8, 2021), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 21000, ajudaCusto: 850, transporte: 0, ferias: { dias: 30, vencimento: _d2(3, 1, 2027) } },
  { id: "c-005", matricula: "FG-00011", nome: "Lívia Câmara", cargo: "Gerente Financeira", area: "Administrativo", vinculo: "CLT", gestor: "Helena Vasconcelos", status: "ativo", entrada: _d2(5, 3, 2022), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 16500, ajudaCusto: 850, transporte: 0, ferias: { dias: 22, vencimento: _d2(5, 8, 2026) } },

  // Criação
  { id: "c-006", matricula: "FG-00012", nome: "João Bertolazi", cargo: "Diretor de Arte Sênior", area: "Criação", vinculo: "CLT", gestor: "Rafael Aguiar", status: "ativo", entrada: _d2(12, 2, 2023), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 14200, ajudaCusto: 850, transporte: 320, ferias: { dias: 20, vencimento: _d2(12, 7, 2026) } },
  { id: "c-007", matricula: "FG-00014", nome: "Pedro Lima", cargo: "Designer Pleno", area: "Criação", vinculo: "CLT", gestor: "João Bertolazi", status: "ativo", entrada: _d2(8, 8, 2023), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 9800, ajudaCusto: 850, transporte: 320, ferias: { dias: 25, vencimento: _d2(8, 1, 2027) } },
  { id: "c-008", matricula: "FG-00016", nome: "Mariana Queiroz", cargo: "Designer Pleno", area: "Criação", vinculo: "CLT", gestor: "João Bertolazi", status: "on_vacation", entrada: _d2(2, 0, 2023), modelo: "Remoto", localizacao: "Florianópolis", remuneracao: 10200, ajudaCusto: 850, transporte: 0, ferias: { dias: 0, vencimento: _d2(2, 5, 2026), emFerias: true } },
  { id: "c-009", matricula: "FG-00018", nome: "Diego Penna", cargo: "Redator Sênior", area: "Criação", vinculo: "PJ", gestor: "Rafael Aguiar", status: "ativo", entrada: _d2(15, 4, 2022), modelo: "Remoto", localizacao: "Belo Horizonte", remuneracao: 14800, ajudaCusto: 0, transporte: 0 },
  { id: "c-010", matricula: "FG-00020", nome: "Carolina Pessoa", cargo: "Diretora de Arte Pleno", area: "Criação", vinculo: "CLT", gestor: "Rafael Aguiar", status: "ativo", entrada: _d2(20, 6, 2023), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 11800, ajudaCusto: 850, transporte: 320, ferias: { dias: 28, vencimento: _d2(20, 11, 2026) } },
  { id: "c-011", matricula: "FG-00031", nome: "Carlos Augusto", cargo: "Diretor de Criação", area: "Criação", vinculo: "PJ", gestor: "Rafael Aguiar", status: "ativo", entrada: _d2(1, 1, 2024), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 18200, ajudaCusto: 0, transporte: 0 },

  // Atendimento
  { id: "c-012", matricula: "FG-00013", nome: "Daniela Marques", cargo: "Atendimento Sênior", area: "Atendimento", vinculo: "CLT", gestor: "Marina Toledo", status: "ativo", entrada: _d2(10, 3, 2022), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 11500, ajudaCusto: 850, transporte: 320, ferias: { dias: 18, vencimento: _d2(10, 8, 2026) } },
  { id: "c-013", matricula: "FG-00015", nome: "Maria Antunes", cargo: "Atendimento Pleno", area: "Atendimento", vinculo: "CLT", gestor: "Marina Toledo", status: "ativo", entrada: _d2(22, 9, 2022), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 8400, ajudaCusto: 850, transporte: 320, ferias: { dias: 15, vencimento: _d2(22, 2, 2027), proximaFerias: _d2(30, 4, 2026) } },
  { id: "c-014", matricula: "FG-00017", nome: "Fernanda Tavares", cargo: "Atendimento Júnior", area: "Atendimento", vinculo: "CLT", gestor: "Marina Toledo", status: "ativo", entrada: _d2(5, 1, 2024), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 5200, ajudaCusto: 850, transporte: 320, ferias: { dias: 28, vencimento: _d2(5, 6, 2026) } },
  { id: "c-015", matricula: "FG-00033", nome: "Lucas Tinoco", cargo: "Atendimento Pleno", area: "Atendimento", vinculo: "PJ", gestor: "Marina Toledo", status: "ativo", entrada: _d2(1, 3, 2024), modelo: "Remoto", localizacao: "Recife", remuneracao: 9600, ajudaCusto: 0, transporte: 0 },

  // Mídia
  { id: "c-016", matricula: "FG-00022", nome: "Beatriz Solano", cargo: "Mídia Pleno", area: "Mídia", vinculo: "PJ", gestor: "Júlia Bernardes", status: "ativo", entrada: _d2(15, 9, 2023), modelo: "Remoto", localizacao: "São Paulo", remuneracao: 9600, ajudaCusto: 0, transporte: 0 },
  { id: "c-017", matricula: "FG-00024", nome: "Tiago Esposito", cargo: "Mídia Sênior", area: "Mídia", vinculo: "CLT", gestor: "Júlia Bernardes", status: "ativo", entrada: _d2(8, 5, 2022), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 13800, ajudaCusto: 850, transporte: 320, ferias: { dias: 20, vencimento: _d2(8, 10, 2026) } },

  // Estratégia
  { id: "c-018", matricula: "FG-00019", nome: "Jéssica Hara", cargo: "Planejamento Sênior", area: "Estratégia", vinculo: "CLT", gestor: "Júlia Bernardes", status: "ativo", entrada: _d2(3, 6, 2023), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 13200, ajudaCusto: 850, transporte: 320, ferias: { dias: 22, vencimento: _d2(3, 11, 2026) } },
  { id: "c-019", matricula: "FG-00029", nome: "Bruno Tavares", cargo: "Planejamento Pleno", area: "Estratégia", vinculo: "PJ", gestor: "Júlia Bernardes", status: "ativo", entrada: _d2(10, 11, 2023), modelo: "Remoto", localizacao: "Porto Alegre", remuneracao: 10400, ajudaCusto: 0, transporte: 0 },

  // Estagiários / Freelancers
  { id: "c-020", matricula: "FG-00034", nome: "Sofia Macedo", cargo: "Designer Estagiária", area: "Criação", vinculo: "Estágio", gestor: "João Bertolazi", status: "ativo", entrada: _d2(1, 2, 2025), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 1800, ajudaCusto: 400, transporte: 220 },
  { id: "c-021", matricula: "FG-00035", nome: "Henrique Costa", cargo: "Redator Estagiário", area: "Criação", vinculo: "Estágio", gestor: "Rafael Aguiar", status: "ativo", entrada: _d2(15, 7, 2025), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 1800, ajudaCusto: 400, transporte: 220 },

  // Em aviso prévio
  { id: "c-022", matricula: "FG-00021", nome: "Roberto Salles", cargo: "Designer Pleno", area: "Criação", vinculo: "CLT", gestor: "João Bertolazi", status: "in_notice", entrada: _d2(1, 10, 2022), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 9600, ajudaCusto: 850, transporte: 320, ferias: { dias: 16, vencimento: _d2(1, 3, 2027) }, desligamentoEm: _d2(5, 5, 2026) },

  // Desligados recentes
  { id: "c-023", matricula: "FG-00027", nome: "Tatiana Reis", cargo: "Atendimento Pleno", area: "Atendimento", vinculo: "CLT", gestor: "Marina Toledo", status: "desligado", entrada: _d2(10, 8, 2022), saida: _d2(12, 4, 2026), modelo: "Híbrido", localizacao: "São Paulo", remuneracao: 0 },
  { id: "c-024", matricula: "FG-00025", nome: "Pedro Henrique Sales", cargo: "Mídia Júnior", area: "Mídia", vinculo: "CLT", gestor: "Júlia Bernardes", status: "desligado", entrada: _d2(15, 1, 2023), saida: _d2(12, 4, 2026), modelo: "Remoto", localizacao: "São Paulo", remuneracao: 0 },
];

// Próximas admissões pendentes
window.FG_ADMISSOES = [
  { id: "adm-001", nome: "Caio Velloso", cargo: "Designer Pleno", area: "Criação", vinculo: "CLT", entrada: _d2(1, 5, 2026), responsavel: "Lívia Câmara", checklist: { total: 12, done: 8, blocked: 1, items: [
    { id: "ck-1", titulo: "Coletar documentação pessoal", responsavel: "Lívia Câmara", status: "done" },
    { id: "ck-2", titulo: "Assinar contrato CLT", responsavel: "Lívia Câmara", status: "done" },
    { id: "ck-3", titulo: "Cadastrar no sistema interno", responsavel: "Lívia Câmara", status: "done" },
    { id: "ck-4", titulo: "Provisionar e-mail @formulagroup", responsavel: "TI", status: "done" },
    { id: "ck-5", titulo: "Provisionar acesso Figma", responsavel: "TI", status: "done" },
    { id: "ck-6", titulo: "Provisionar acesso Adobe CC", responsavel: "TI", status: "done" },
    { id: "ck-7", titulo: "Provisionar acesso Google Drive", responsavel: "TI", status: "done" },
    { id: "ck-8", titulo: "Solicitar MacBook + acessórios", responsavel: "TI", status: "done" },
    { id: "ck-9", titulo: "Configurar VR/VA", responsavel: "Lívia Câmara", status: "in_progress" },
    { id: "ck-10", titulo: "Configurar Gympass", responsavel: "Lívia Câmara", status: "pending" },
    { id: "ck-11", titulo: "Inscrever em plano de saúde", responsavel: "Lívia Câmara", status: "blocked", motivo: "Aguardando comprovante de dependente" },
    { id: "ck-12", titulo: "Onboarding com o time", responsavel: "Rafael Aguiar", status: "pending" },
  ] } },
];

window.FG_DESLIGAMENTOS = [
  { id: "des-001", colaborador: "Roberto Salles", matricula: "FG-00021", area: "Criação", cargo: "Designer Pleno", inicio: _d2(20, 4, 2026), prevista: _d2(5, 5, 2026), responsavel: "Lívia Câmara", checklist: { total: 10, done: 5, blocked: 2, items: [
    { id: "dk-1", titulo: "Aviso prévio formal assinado", responsavel: "Lívia Câmara", status: "done" },
    { id: "dk-2", titulo: "Pagar verbas rescisórias", responsavel: "Lívia Câmara", status: "in_progress" },
    { id: "dk-3", titulo: "Remover acesso Google Workspace", responsavel: "TI", status: "done" },
    { id: "dk-4", titulo: "Remover acesso Figma", responsavel: "TI", status: "done" },
    { id: "dk-5", titulo: "Remover acesso Adobe CC", responsavel: "TI", status: "done" },
    { id: "dk-6", titulo: "Receber MacBook (EQ-00019)", responsavel: "TI", status: "in_progress" },
    { id: "dk-7", titulo: "Fechar última NF (não aplicável)", responsavel: "Lívia Câmara", status: "done" },
    { id: "dk-8", titulo: "Aprovar/recusar reembolsos pendentes", responsavel: "Marina Toledo", status: "blocked", motivo: "1 reembolso aguardando documento adicional" },
    { id: "dk-9", titulo: "Cancelar VR/VA e benefícios", responsavel: "Lívia Câmara", status: "pending" },
    { id: "dk-10", titulo: "Coleta de feedback de saída", responsavel: "Helena Vasconcelos", status: "blocked", motivo: "Agendar entrevista" },
  ] } },
  { id: "des-002", colaborador: "Tatiana Reis", matricula: "FG-00027", area: "Atendimento", cargo: "Atendimento Pleno", inicio: _d2(28, 3, 2026), prevista: _d2(12, 4, 2026), responsavel: "Lívia Câmara", checklist: { total: 10, done: 8, blocked: 1, items: [] } },
];

// ────────────────────────────────────────────────────────────────────────────
// NFs (invoice_requests) — composições por PJ por competência
// ────────────────────────────────────────────────────────────────────────────
window.FG_NFS = [
  // Aguardando envio
  { id: "nf-001", colaborador: "Carlos Augusto", matricula: "FG-00031", area: "Criação", competencia: "mai/26", prazo: _d2(30), valorEsperado: 11240, valorEmitido: null, status: "aguardando_envio", composicao: [
    { item: "Remuneração base", valor: 14800 },
    { item: "Reembolso shooting incluso", valor: 1240 },
    { item: "Desconto INSS contratual", valor: -1800 },
    { item: "Desconto adiantamento abr/26", valor: -3000 },
  ] },
  { id: "nf-002", colaborador: "Diego Penna", matricula: "FG-00018", area: "Criação", competencia: "mai/26", prazo: _d2(30), valorEsperado: 14800, valorEmitido: null, status: "aguardando_envio", composicao: [
    { item: "Remuneração base", valor: 14800 },
  ] },
  { id: "nf-003", colaborador: "Beatriz Solano", matricula: "FG-00022", area: "Mídia", competencia: "mai/26", prazo: _d2(30), valorEsperado: 9600, valorEmitido: null, status: "aguardando_envio", composicao: [
    { item: "Remuneração base", valor: 9600 },
  ] },
  { id: "nf-004", colaborador: "Lucas Tinoco", matricula: "FG-00033", area: "Atendimento", competencia: "mai/26", prazo: _d2(30), valorEsperado: 9600, valorEmitido: null, status: "aguardando_envio", composicao: [{ item: "Remuneração base", valor: 9600 }] },
  { id: "nf-005", colaborador: "Bruno Tavares", matricula: "FG-00029", area: "Estratégia", competencia: "mai/26", prazo: _d2(30), valorEsperado: 10400, valorEmitido: null, status: "aguardando_envio", composicao: [{ item: "Remuneração base", valor: 10400 }] },

  // Enviadas (em revisão)
  { id: "nf-006", colaborador: "Beatriz Solano", matricula: "FG-00022", area: "Mídia", competencia: "abr/26", prazo: _d2(30, 3), valorEsperado: 9600, valorEmitido: 9600, status: "enviada", numeroNF: "NF 0287", emitidaEm: _d2(28, 3), composicao: [{ item: "Remuneração base", valor: 9600 }] },
  { id: "nf-007", colaborador: "Diego Penna", matricula: "FG-00018", area: "Criação", competencia: "abr/26", prazo: _d2(30, 3), valorEsperado: 14800, valorEmitido: 14800, status: "enviada", numeroNF: "NF 0712", emitidaEm: _d2(29, 3), composicao: [{ item: "Remuneração base", valor: 14800 }] },

  // Divergentes
  { id: "nf-008", colaborador: "Carlos Augusto", matricula: "FG-00031", area: "Criação", competencia: "abr/26", prazo: _d2(30, 3), valorEsperado: 11240, valorEmitido: 11780, status: "divergente", numeroNF: "NF 0123", emitidaEm: _d2(30, 3), composicao: [
    { item: "Remuneração base", valor: 14800 },
    { item: "Reembolso abril", valor: 240 },
    { item: "Desconto INSS contratual", valor: -1800 },
    { item: "Desconto adiantamento mar/26", valor: -2000 },
  ], divergencia: { valor: 540, motivo: "Valor emitido R$ 540,00 maior que esperado." } },

  // Aprovadas / lançadas / pagas (histórico)
  { id: "nf-009", colaborador: "Lucas Tinoco", matricula: "FG-00033", area: "Atendimento", competencia: "abr/26", prazo: _d2(30, 3), valorEsperado: 9600, valorEmitido: 9600, status: "aprovada", numeroNF: "NF 0044", emitidaEm: _d2(27, 3), composicao: [{ item: "Remuneração base", valor: 9600 }] },
  { id: "nf-010", colaborador: "Bruno Tavares", matricula: "FG-00029", area: "Estratégia", competencia: "abr/26", prazo: _d2(30, 3), valorEsperado: 10400, valorEmitido: 10400, status: "lancada", numeroNF: "NF 0511", emitidaEm: _d2(26, 3), composicao: [{ item: "Remuneração base", valor: 10400 }] },
  { id: "nf-011", colaborador: "Carlos Augusto", matricula: "FG-00031", area: "Criação", competencia: "mar/26", prazo: _d2(31, 2), valorEsperado: 11000, valorEmitido: 11000, status: "pago", numeroNF: "NF 0118", emitidaEm: _d2(30, 2), composicao: [{ item: "Remuneração base", valor: 11000 }] },
];

// ────────────────────────────────────────────────────────────────────────────
// Reembolsos
// ────────────────────────────────────────────────────────────────────────────
window.FG_REEMBOLSOS = [
  { id: "rb-001", colaborador: "Daniela Marques", area: "Atendimento", vinculo: "CLT", dataDespesa: _d2(17), categoria: "Refeição com cliente", valor: 1245.30, descricao: "Almoço com cliente Pampulha Banking — 4 pessoas — Restaurante Tordesilhas", cliente: "Pampulha Banking", centroCusto: "Atendimento", status: "aguardando_envio", anexo: "comprovante-tordesilhas.pdf" },
  { id: "rb-002", colaborador: "Pedro Lima", area: "Criação", vinculo: "CLT", dataDespesa: _d2(18), categoria: "Transporte", valor: 286.40, descricao: "Uber produção Nova Roma (3 trechos)", cliente: "Nova Roma Modas", centroCusto: "Criação", status: "enviada", anexo: "uber-recibos.pdf" },
  { id: "rb-003", colaborador: "Jéssica Hara", area: "Estratégia", vinculo: "CLT", dataDespesa: _d2(14), categoria: "Workshop / Evento", valor: 640.00, descricao: "Inscrição workshop estratégia digital SP", centroCusto: "Estratégia", status: "aprovada", anexo: "comprovante-workshop.pdf", aprovacoes: { gestor: { por: "Júlia Bernardes", em: _d2(15) } } },
  { id: "rb-004", colaborador: "Beatriz Solano", area: "Mídia", vinculo: "PJ", dataDespesa: _d2(10), categoria: "Material gráfico", valor: 412.85, descricao: "Impressão materiais campanha Sertão", cliente: "Sertão Bebidas", centroCusto: "Mídia", status: "aprovada", anexo: "nf-grafica.pdf", aprovacoes: { gestor: { por: "Júlia Bernardes", em: _d2(12) }, financeiro: { por: "Lívia Câmara", em: _d2(14) } }, incluirEmNF: true },
  { id: "rb-005", colaborador: "Carlos Augusto", area: "Criação", vinculo: "PJ", dataDespesa: _d2(5), categoria: "Shooting / Produção", valor: 1240.00, descricao: "Aluguel câmera + cartões SD para shooting Boa Vista", cliente: "Boa Vista Cosméticos", centroCusto: "Criação", status: "aprovada", anexo: "shooting-equip.pdf", aprovacoes: { gestor: { por: "Rafael Aguiar", em: _d2(7) }, financeiro: { por: "Lívia Câmara", em: _d2(9) } }, incluirEmNF: true, nfAtrelada: "nf-001" },
  { id: "rb-006", colaborador: "Roberto Salles", area: "Criação", vinculo: "CLT", dataDespesa: _d2(8), categoria: "Software", valor: 480.00, descricao: "Plugin Sketch Symbols (já reembolsado anteriormente?)", centroCusto: "Criação", status: "recusada", aprovacoes: { gestor: { por: "João Bertolazi", em: _d2(11), motivo: "Item duplicado — já reembolsado em fev/26" } } },
  { id: "rb-007", colaborador: "Tiago Esposito", area: "Mídia", vinculo: "CLT", dataDespesa: _d2(3), categoria: "Refeição com cliente", valor: 268.50, descricao: "Café com Pampulha Banking", cliente: "Pampulha Banking", centroCusto: "Mídia", status: "pago", anexo: "comprovante-cafe.pdf" },
  { id: "rb-008", colaborador: "Maria Antunes", area: "Atendimento", vinculo: "CLT", dataDespesa: _d2(2), categoria: "Transporte", valor: 92.40, descricao: "Uber reunião cliente Vento Sul", cliente: "Vento Sul Mobilidade", centroCusto: "Atendimento", status: "pago", anexo: "uber.pdf" },
];

// ────────────────────────────────────────────────────────────────────────────
// Férias / pausas
// ────────────────────────────────────────────────────────────────────────────
window.FG_FERIAS = [
  { id: "f-001", colaborador: "Mariana Queiroz", matricula: "FG-00016", area: "Criação", vinculo: "CLT", tipo: "Férias", inicio: _d2(15, 4, 2026), fim: _d2(31, 4, 2026), dias: 17, status: "aprovada", aprovador: "João Bertolazi" },
  { id: "f-002", colaborador: "Maria Antunes", matricula: "FG-00015", area: "Atendimento", vinculo: "CLT", tipo: "Férias", inicio: _d2(30, 4, 2026), fim: _d2(13, 5, 2026), dias: 15, status: "aprovada", aprovador: "Marina Toledo" },
  { id: "f-003", colaborador: "Tiago Esposito", matricula: "FG-00024", area: "Mídia", vinculo: "CLT", tipo: "Férias", inicio: _d2(8, 6, 2026), fim: _d2(28, 6, 2026), dias: 21, status: "previsto", aprovador: "Júlia Bernardes" },
  { id: "f-004", colaborador: "Diego Penna", matricula: "FG-00018", area: "Criação", vinculo: "PJ", tipo: "Pausa programada", inicio: _d2(20, 5, 2026), fim: _d2(27, 5, 2026), dias: 8, status: "aprovada", aprovador: "Rafael Aguiar" },
  { id: "f-005", colaborador: "Daniela Marques", matricula: "FG-00013", area: "Atendimento", vinculo: "CLT", tipo: "Férias", inicio: _d2(15, 7, 2026), fim: _d2(4, 8, 2026), dias: 21, status: "previsto", aprovador: "Marina Toledo" },
  { id: "f-006", colaborador: "Carolina Pessoa", matricula: "FG-00020", area: "Criação", vinculo: "CLT", tipo: "Férias", inicio: _d2(28, 5, 2026), fim: _d2(11, 6, 2026), dias: 15, status: "aprovada", aprovador: "Rafael Aguiar" },
  { id: "f-007", colaborador: "Pedro Lima", matricula: "FG-00014", area: "Criação", vinculo: "CLT", tipo: "Férias", inicio: _d2(12, 7, 2026), fim: _d2(1, 8, 2026), dias: 21, status: "previsto", aprovador: "João Bertolazi" },
  { id: "f-008", colaborador: "Bruno Tavares", matricula: "FG-00029", area: "Estratégia", vinculo: "PJ", tipo: "Pausa programada", inicio: _d2(3, 6, 2026), fim: _d2(10, 6, 2026), dias: 8, status: "aprovada", aprovador: "Júlia Bernardes" },
  { id: "f-009", colaborador: "Lívia Câmara", matricula: "FG-00011", area: "Administrativo", vinculo: "CLT", tipo: "Férias", inicio: _d2(20, 11, 2026), fim: _d2(10, 0, 2027), dias: 22, status: "previsto", aprovador: "Helena Vasconcelos" },
];

// Histórico de aumentos
window.FG_AUMENTOS = {
  "c-006": [
    { data: _d2(1, 1, 2026), valorAnterior: 12800, valorNovo: 14200, motivo: "Revisão anual + promoção a Sênior", aprovado: "Helena Vasconcelos" },
    { data: _d2(15, 6, 2024), valorAnterior: 11000, valorNovo: 12800, motivo: "Revisão de mercado", aprovado: "Helena Vasconcelos" },
    { data: _d2(12, 1, 2023), valorAnterior: 0, valorNovo: 11000, motivo: "Admissão", aprovado: "Helena Vasconcelos" },
  ],
  "c-012": [
    { data: _d2(1, 7, 2025), valorAnterior: 10500, valorNovo: 11500, motivo: "Revisão anual", aprovado: "Helena Vasconcelos" },
    { data: _d2(10, 2, 2022), valorAnterior: 0, valorNovo: 10500, motivo: "Admissão", aprovado: "Helena Vasconcelos" },
  ],
};

// Equipamentos por colaborador
window.FG_EQUIPAMENTOS_DE = {
  "c-006": [{ patrimonio: "EQ-00012", tipo: "MacBook Pro 14\" M3", entrega: _d2(12, 2, 2024), estado: "Excelente" }],
  "c-012": [{ patrimonio: "EQ-00018", tipo: "MacBook Air 13\" M2", entrega: _d2(10, 3, 2022), estado: "Bom" }],
};
