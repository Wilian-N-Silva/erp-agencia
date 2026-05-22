// Mock data — Sistema Interno FG
// Todas em PT-BR, com nomes brasileiros fictícios e R$ realistas.
// Hoje (para a UI) = 21 de maio de 2026.

window.FG_TODAY = new Date(2026, 4, 21); // mês 4 = maio

window.FG_USER = {
  id: "u-001",
  nome: "Helena Vasconcelos",
  primeiroNome: "Helena",
  cargo: "Diretora Executiva",
  email: "helena@formulagroup.com.br",
  iniciais: "HV",
  perfil: "diretoria",
};

// ────────────────────────────────────────────────────────────────────────────
// Clientes
// ────────────────────────────────────────────────────────────────────────────
window.FG_CLIENTES = [
  { id: "cli-001", codigo: "FG-CLI-00012", nome: "Boa Vista Cosméticos", responsavel: "Marina Toledo", fee: 48000, dia: 5, status: "ativo", statusMes: "recebido" },
  { id: "cli-002", codigo: "FG-CLI-00018", nome: "Riacho Joalheria", responsavel: "Rafael Aguiar", fee: 32000, dia: 10, status: "ativo", statusMes: "previsto" },
  { id: "cli-003", codigo: "FG-CLI-00007", nome: "Vento Sul Mobilidade", responsavel: "Marina Toledo", fee: 65000, dia: 15, status: "ativo", statusMes: "atrasado" },
  { id: "cli-004", codigo: "FG-CLI-00021", nome: "Cesta Pronta Hortifruti", responsavel: "Júlia Bernardes", fee: 18500, dia: 5, status: "ativo", statusMes: "recebido" },
  { id: "cli-005", codigo: "FG-CLI-00009", nome: "Nova Roma Modas", responsavel: "Rafael Aguiar", fee: 42000, dia: 20, status: "ativo", statusMes: "previsto" },
  { id: "cli-006", codigo: "FG-CLI-00014", nome: "Sertão Bebidas", responsavel: "Marina Toledo", fee: 28000, dia: 1, status: "ativo", statusMes: "parcial" },
  { id: "cli-007", codigo: "FG-CLI-00003", nome: "Pampulha Banking", responsavel: "Helena Vasconcelos", fee: 95000, dia: 10, status: "ativo", statusMes: "recebido" },
  { id: "cli-008", codigo: "FG-CLI-00026", nome: "Linhares Educação", responsavel: "Júlia Bernardes", fee: 22000, dia: 25, status: "pausado", statusMes: "cancelado" },
];

// ────────────────────────────────────────────────────────────────────────────
// Fornecedores
// ────────────────────────────────────────────────────────────────────────────
window.FG_FORNECEDORES = [
  { id: "for-001", nome: "Adobe Systems Brasil", categoria: "saas" },
  { id: "for-002", nome: "Google Cloud Platform", categoria: "saas" },
  { id: "for-003", nome: "Figma Inc.", categoria: "saas" },
  { id: "for-004", nome: "Cloudflare", categoria: "saas" },
  { id: "for-005", nome: "Imobiliária Sumaré", categoria: "infra" },
  { id: "for-006", nome: "Enel Distribuição", categoria: "infra" },
  { id: "for-007", nome: "Sabesp", categoria: "infra" },
  { id: "for-008", nome: "Mendes Contabilidade", categoria: "servicos" },
  { id: "for-009", nome: "iFood Corporate", categoria: "beneficios" },
  { id: "for-010", nome: "Gympass Brasil", categoria: "beneficios" },
  { id: "for-011", nome: "Studio Tipo Reverso", categoria: "freelance" },
  { id: "for-012", nome: "Bruno Caetano Fotografia", categoria: "freelance" },
];

// ────────────────────────────────────────────────────────────────────────────
// Categorias
// ────────────────────────────────────────────────────────────────────────────
window.FG_CATEGORIAS_ENTRADA = [
  "Fee mensal", "Projeto pontual", "Mídia repassada", "Reembolso de produção", "Outras receitas",
];
window.FG_CATEGORIAS_SAIDA = [
  "Folha CLT", "Pró-labore", "NFs PJ", "Aluguel", "SaaS", "Energia/Água", "Internet", "Contabilidade",
  "Marketing", "Equipamentos", "Benefícios", "Freelancers", "Reembolsos", "Impostos", "Outros",
];
window.FG_CENTROS_CUSTO = ["Operação", "Criação", "Atendimento", "Mídia", "Estratégia", "Administrativo"];

// ────────────────────────────────────────────────────────────────────────────
// Entradas financeiras — competência maio/2026
// ────────────────────────────────────────────────────────────────────────────
function _d(dia, mes = 4, ano = 2026) { return new Date(ano, mes, dia); }

window.FG_ENTRADAS = [
  { id: "e-001", cliente: "Pampulha Banking", clienteId: "cli-007", descricao: "Fee maio/26", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(10), valorPrevisto: 95000, valorRecebido: 95000, recebidoEm: _d(9), status: "recebido", responsavel: "Helena Vasconcelos", metodo: "TED" },
  { id: "e-002", cliente: "Boa Vista Cosméticos", clienteId: "cli-001", descricao: "Fee maio/26", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(5), valorPrevisto: 48000, valorRecebido: 48000, recebidoEm: _d(5), status: "recebido", responsavel: "Marina Toledo", metodo: "PIX" },
  { id: "e-003", cliente: "Vento Sul Mobilidade", clienteId: "cli-003", descricao: "Fee maio/26", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(15), valorPrevisto: 65000, valorRecebido: 0, status: "atrasado", responsavel: "Marina Toledo", metodo: "Boleto" },
  { id: "e-004", cliente: "Nova Roma Modas", clienteId: "cli-005", descricao: "Fee maio/26", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(20), valorPrevisto: 42000, valorRecebido: 0, status: "previsto", responsavel: "Rafael Aguiar", metodo: "TED" },
  { id: "e-005", cliente: "Cesta Pronta Hortifruti", clienteId: "cli-004", descricao: "Fee maio/26", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(5), valorPrevisto: 18500, valorRecebido: 18500, recebidoEm: _d(6), status: "recebido", responsavel: "Júlia Bernardes", metodo: "PIX" },
  { id: "e-006", cliente: "Sertão Bebidas", clienteId: "cli-006", descricao: "Fee maio/26 — 1ª parcela", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(1), valorPrevisto: 28000, valorRecebido: 14000, recebidoEm: _d(3), status: "recebido", responsavel: "Marina Toledo", metodo: "PIX" },
  { id: "e-007", cliente: "Sertão Bebidas", clienteId: "cli-006", descricao: "Fee maio/26 — 2ª parcela", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(16), valorPrevisto: 14000, valorRecebido: 0, status: "atrasado", responsavel: "Marina Toledo", metodo: "PIX" },
  { id: "e-008", cliente: "Riacho Joalheria", clienteId: "cli-002", descricao: "Fee maio/26", categoria: "Fee mensal", competencia: "mai/26", vencimento: _d(10), valorPrevisto: 32000, valorRecebido: 32000, recebidoEm: _d(11), status: "recebido", responsavel: "Rafael Aguiar", metodo: "TED" },
  { id: "e-009", cliente: "Pampulha Banking", clienteId: "cli-007", descricao: "Projeto Onboarding App", categoria: "Projeto pontual", competencia: "mai/26", vencimento: _d(28), valorPrevisto: 180000, valorRecebido: 0, status: "previsto", responsavel: "Helena Vasconcelos", metodo: "TED" },
  { id: "e-010", cliente: "Boa Vista Cosméticos", clienteId: "cli-001", descricao: "Mídia repassada — Meta Ads", categoria: "Mídia repassada", competencia: "mai/26", vencimento: _d(25), valorPrevisto: 56400, valorRecebido: 0, status: "previsto", responsavel: "Marina Toledo", metodo: "TED" },
  { id: "e-011", cliente: "Vento Sul Mobilidade", clienteId: "cli-003", descricao: "Produção campanha Inverno", categoria: "Projeto pontual", competencia: "mai/26", vencimento: _d(30), valorPrevisto: 72000, valorRecebido: 0, status: "previsto", responsavel: "Marina Toledo", metodo: "TED" },
  { id: "e-012", cliente: "Nova Roma Modas", clienteId: "cli-005", descricao: "Reembolso shooting", categoria: "Reembolso de produção", competencia: "mai/26", vencimento: _d(22), valorPrevisto: 8420, valorRecebido: 0, status: "previsto", responsavel: "Rafael Aguiar", metodo: "PIX" },
  // Abril (histórico)
  { id: "e-013", cliente: "Pampulha Banking", clienteId: "cli-007", descricao: "Fee abril/26", categoria: "Fee mensal", competencia: "abr/26", vencimento: _d(10, 3), valorPrevisto: 95000, valorRecebido: 95000, recebidoEm: _d(10, 3), status: "recebido", responsavel: "Helena Vasconcelos", metodo: "TED" },
  { id: "e-014", cliente: "Boa Vista Cosméticos", clienteId: "cli-001", descricao: "Fee abril/26", categoria: "Fee mensal", competencia: "abr/26", vencimento: _d(5, 3), valorPrevisto: 48000, valorRecebido: 48000, recebidoEm: _d(5, 3), status: "recebido", responsavel: "Marina Toledo", metodo: "PIX" },
];

// ────────────────────────────────────────────────────────────────────────────
// Saídas financeiras — competência maio/2026
// ────────────────────────────────────────────────────────────────────────────
window.FG_SAIDAS = [
  { id: "s-001", fornecedor: "Folha CLT", categoria: "Folha CLT", descricao: "Folha CLT mai/26 — 28 colab.", competencia: "mai/26", vencimento: _d(5), valor: 412800, status: "pago", pagoEm: _d(5), centroCusto: "Operação", responsavel: "Lívia Câmara", metodo: "TED" },
  { id: "s-002", fornecedor: "Adobe Systems Brasil", categoria: "SaaS", descricao: "Creative Cloud Teams — 22 licenças", competencia: "mai/26", vencimento: _d(8), valor: 14256, status: "pago", pagoEm: _d(8), centroCusto: "Criação", responsavel: "Lívia Câmara", metodo: "Cartão" },
  { id: "s-003", fornecedor: "Figma Inc.", categoria: "SaaS", descricao: "Organization — 18 editores", competencia: "mai/26", vencimento: _d(10), valor: 8910, status: "pago", pagoEm: _d(10), centroCusto: "Criação", responsavel: "Lívia Câmara", metodo: "Cartão" },
  { id: "s-004", fornecedor: "Google Cloud Platform", categoria: "SaaS", descricao: "Workspace + GCP", competencia: "mai/26", vencimento: _d(12), valor: 6840, status: "pago", pagoEm: _d(12), centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "Cartão" },
  { id: "s-005", fornecedor: "Imobiliária Sumaré", categoria: "Aluguel", descricao: "Aluguel sede mai/26", competencia: "mai/26", vencimento: _d(10), valor: 38500, status: "pago", pagoEm: _d(10), centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "Boleto" },
  { id: "s-006", fornecedor: "Enel Distribuição", categoria: "Energia/Água", descricao: "Energia abr/26", competencia: "mai/26", vencimento: _d(18), valor: 4280, status: "previsto", centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "Débito" },
  { id: "s-007", fornecedor: "Sabesp", categoria: "Energia/Água", descricao: "Água abr/26", competencia: "mai/26", vencimento: _d(16), valor: 612, status: "atrasado", centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "Débito" },
  { id: "s-008", fornecedor: "Mendes Contabilidade", categoria: "Contabilidade", descricao: "Honorários mai/26", competencia: "mai/26", vencimento: _d(15), valor: 6800, status: "pago", pagoEm: _d(15), centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "PIX" },
  { id: "s-009", fornecedor: "iFood Corporate", categoria: "Benefícios", descricao: "VR/VA mai/26 — 28 colab.", competencia: "mai/26", vencimento: _d(25), valor: 36400, status: "previsto", centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "TED" },
  { id: "s-010", fornecedor: "Gympass Brasil", categoria: "Benefícios", descricao: "Gympass mai/26 — 19 ativos", competencia: "mai/26", vencimento: _d(20), valor: 2470, status: "previsto", centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "Cartão" },
  { id: "s-011", fornecedor: "Studio Tipo Reverso", categoria: "Freelancers", descricao: "Direção de arte campanha Inverno", competencia: "mai/26", vencimento: _d(22), valor: 18500, status: "aguardando_nf", centroCusto: "Criação", responsavel: "Rafael Aguiar", metodo: "PIX" },
  { id: "s-012", fornecedor: "Bruno Caetano Fotografia", categoria: "Freelancers", descricao: "Shooting Nova Roma", competencia: "mai/26", vencimento: _d(24), valor: 12400, status: "previsto", centroCusto: "Criação", responsavel: "Rafael Aguiar", metodo: "PIX" },
  { id: "s-013", fornecedor: "NFs PJ — 14 colab.", categoria: "NFs PJ", descricao: "Composição NFs PJ mai/26", competencia: "mai/26", vencimento: _d(30), valor: 184200, status: "previsto", centroCusto: "Operação", responsavel: "Lívia Câmara", metodo: "TED" },
  { id: "s-014", fornecedor: "Cloudflare", categoria: "SaaS", descricao: "Pro plan + R2", competencia: "mai/26", vencimento: _d(14), valor: 1180, status: "pago", pagoEm: _d(14), centroCusto: "Operação", responsavel: "Lívia Câmara", metodo: "Cartão" },
  { id: "s-015", fornecedor: "Receita Federal", categoria: "Impostos", descricao: "DAS Simples Nacional abr/26", competencia: "mai/26", vencimento: _d(20), valor: 28140, status: "previsto", centroCusto: "Administrativo", responsavel: "Lívia Câmara", metodo: "Boleto" },
];

// ────────────────────────────────────────────────────────────────────────────
// Provisões (recorrentes / previstas para os próximos meses)
// ────────────────────────────────────────────────────────────────────────────
window.FG_PROVISOES = [
  { id: "p-001", descricao: "Folha CLT — média mensal", categoria: "Folha CLT", valor: 412800, recorrencia: "Mensal", proxima: _d(5, 5), centroCusto: "Operação", ativo: true },
  { id: "p-002", descricao: "NFs PJ — composição mensal", categoria: "NFs PJ", valor: 184200, recorrencia: "Mensal", proxima: _d(30, 4), centroCusto: "Operação", ativo: true },
  { id: "p-003", descricao: "Aluguel sede + condomínio", categoria: "Aluguel", valor: 38500, recorrencia: "Mensal", proxima: _d(10, 5), centroCusto: "Administrativo", ativo: true },
  { id: "p-004", descricao: "Pacote Adobe Creative Cloud", categoria: "SaaS", valor: 14256, recorrencia: "Mensal", proxima: _d(8, 5), centroCusto: "Criação", ativo: true },
  { id: "p-005", descricao: "Figma Organization", categoria: "SaaS", valor: 8910, recorrencia: "Mensal", proxima: _d(10, 5), centroCusto: "Criação", ativo: true },
  { id: "p-006", descricao: "Vale Refeição/Alimentação", categoria: "Benefícios", valor: 36400, recorrencia: "Mensal", proxima: _d(25, 4), centroCusto: "Administrativo", ativo: true },
  { id: "p-007", descricao: "DAS Simples Nacional", categoria: "Impostos", valor: 28140, recorrencia: "Mensal", proxima: _d(20, 4), centroCusto: "Administrativo", ativo: true },
  { id: "p-008", descricao: "13º — provisão mensal", categoria: "Folha CLT", valor: 34400, recorrencia: "Mensal", proxima: _d(31, 11), centroCusto: "Operação", ativo: true },
  { id: "p-009", descricao: "Honorários contábeis", categoria: "Contabilidade", valor: 6800, recorrencia: "Mensal", proxima: _d(15, 5), centroCusto: "Administrativo", ativo: true },
  { id: "p-010", descricao: "Pacote Google Workspace + GCP", categoria: "SaaS", valor: 6840, recorrencia: "Mensal", proxima: _d(12, 5), centroCusto: "Administrativo", ativo: true },
  { id: "p-011", descricao: "Energia + Água sede", categoria: "Energia/Água", valor: 4900, recorrencia: "Mensal", proxima: _d(16, 4), centroCusto: "Administrativo", ativo: true },
  { id: "p-012", descricao: "Provisão FGTS + INSS sobre folha", categoria: "Impostos", valor: 124800, recorrencia: "Mensal", proxima: _d(20, 4), centroCusto: "Operação", ativo: true },
];

// ────────────────────────────────────────────────────────────────────────────
// Alertas críticos
// ────────────────────────────────────────────────────────────────────────────
window.FG_ALERTAS = [
  { id: "a-001", severidade: "critico", titulo: "Acesso ativo após desligamento", subtitulo: "Pedro Henrique Sales · removido em 12/05", contexto: "Google Workspace — criticidade alta", tipo: "acesso", quando: "há 2h" },
  { id: "a-002", severidade: "alto", titulo: "Equipamento pendente de devolução", subtitulo: "MacBook Pro 14\" M3 · EQ-00027", contexto: "Tatiana Reis — desligada há 9 dias", tipo: "equipamento", quando: "há 1d" },
  { id: "a-003", severidade: "alto", titulo: "NF com divergência", subtitulo: "Carlos Augusto · competência abr/26", contexto: "Valor emitido R$ 540,00 maior que esperado", tipo: "nf", quando: "há 1d" },
  { id: "a-004", severidade: "medio", titulo: "Renovação SaaS em 14 dias", subtitulo: "Figma Organization · R$ 8.910/mês", contexto: "Próxima cobrança 10/jun", tipo: "saas", quando: "há 3d" },
  { id: "a-005", severidade: "medio", titulo: "Reembolso aguardando aprovação", subtitulo: "Daniela Marques · R$ 1.245,30", contexto: "Atendimento — enviado há 4 dias", tipo: "reembolso", quando: "há 4d" },
];

// ────────────────────────────────────────────────────────────────────────────
// Eventos próximos (dashboard)
// ────────────────────────────────────────────────────────────────────────────
window.FG_EVENTOS = [
  { id: "ev-1", tipo: "aniversario", titulo: "Aniversário · João Bertolazi", quando: "sáb, 23 mai" },
  { id: "ev-2", tipo: "ferias", titulo: "Férias · Maria Antunes (15d)", quando: "30 mai → 13 jun" },
  { id: "ev-3", tipo: "renovacao", titulo: "Renovação Figma Organization", quando: "10 jun" },
  { id: "ev-4", tipo: "admissao", titulo: "Admissão · Caio Velloso (Designer Pleno)", quando: "01 jun" },
  { id: "ev-5", tipo: "desligamento", titulo: "Desligamento concluído · Tatiana Reis", quando: "20 mai" },
];
