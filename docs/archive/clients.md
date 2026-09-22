A tela de Clientes ficou simples demais. Refaça o módulo de Clientes para tratar cliente como uma central de cobrança recorrente, não apenas cadastro.

Leia o PRD em /docs/PRD-Sistema-Interno-FG-v1.md, especialmente as seções 6.2 Financeiro e 6.3 Clientes.

Problema atual:
A tela criada tem apenas cadastro do cliente e status ativo/inativo. Isso é insuficiente. Precisamos controlar detalhes de pagamento, método de pagamento, prazos, vencimentos, lembretes e histórico financeiro por cliente.

Escopo obrigatório:

1. Criar página de detalhe do cliente:
   /app/clientes/[id]

2. A página deve ter abas:
   - Resumo
   - Pagamentos
   - Cobrança
   - Contratos e documentos
   - Histórico
   - Observações internas

3. Aba Resumo:
   Mostrar cards com:
   - status do cliente
   - status financeiro do mês
   - fee mensal
   - próximo vencimento
   - método de pagamento padrão
   - responsável interno
   - último pagamento
   - total em atraso, se houver

4. Aba Pagamentos:
   Mostrar tabela com entradas financeiras vinculadas ao cliente:
   - competência
   - vencimento
   - valor previsto
   - valor recebido
   - método de pagamento
   - status
   - data de recebimento
   - ação para marcar como recebido

5. Aba Cobrança:
   Criar ou ajustar dados de cobrança do cliente:
   - valor mensal fee
   - dia de vencimento
   - método de pagamento padrão
   - prazo de pagamento
   - recorrência
   - gerar entrada prevista automaticamente
   - contato financeiro do cliente
   - e-mail financeiro
   - telefone/WhatsApp financeiro
   - responsável interno pela cobrança
   - lembrete antes do vencimento
   - lembrete após vencimento
   - observações de cobrança

6. Lembretes:
   Implementar alertas internos para:
   - cobrança próxima do vencimento
   - cobrança vencendo hoje
   - cobrança atrasada
   - cliente com pagamento parcial
   - cliente com múltiplas cobranças abertas

7. Banco:
   Criar tabela client_billing_profiles ou equivalente.
   Criar tabela client_payment_reminders ou equivalente, se necessário.
   Garantir vínculo correto com financial_entries.

8. Permissões:
   - Diretoria e Financeiro veem todos os dados financeiros.
   - Liderança só vê clientes sob sua responsabilidade, se configurado.
   - Usuários sem permissão financeira não recebem valores no payload.
   - Alterações financeiras geram audit log.

9. Critérios de aceite:
   - Cliente ativo com fee e cobrança configurada permite gerar entrada prevista.
   - Cliente cancelado não gera nova entrada.
   - Cliente pausado aparece separado.
   - Histórico de pagamentos aparece na página do cliente.
   - Lembretes aparecem no dashboard.
   - Marcar pagamento como recebido atualiza status e gera audit log.
   - Build e testes passam.

Não implementar:
- Integração com Asaas.
- Envio automático de WhatsApp.
- Envio automático de e-mail.
- Pagamento automático.
- Emissão automática de boleto ou NF.