# Assinaturas — valor por ciclo e estimativa de câmbio

Branch `codex/saas-currency-cycle`. Implementação do recorte de moeda e
periodicidade de SAA-001, conforme requisito do usuário; não conclui todo o modelo
de licenças, classificação gerencial ou integração financeira SAA-004.

## Uso

Em Assinaturas → Cadastrar assinatura, informe BRL, USD ou EUR, ciclo mensal ou
anual e valor na moeda escolhida. Uma assinatura anual de EUR 120 é um compromisso
anual de EUR 120; não representa doze cobranças desse valor.

Para USD/EUR, abra “Cotação estimada” e informe reais por unidade, data e fonte
(por exemplo, simulação do cartão). Cotação manual foi escolhida para permitir
uso imediato com origem documentada, sem depender de provedor externo. Sem
cotação, a assinatura continua cadastrável, mas sua estimativa em reais fica
pendente. O indicador geral informa quantas assinaturas não têm estimativa.

Contrato permite consultar e atualizar esses campos. Fórmula: valor por ciclo ×
cotação = estimativa em BRL. No ciclo anual, equivalente mensal = estimativa / 12.
No mensal, anualizado = estimativa × 12. Arredondamento em centavos, sem reutilizar
o mensal arredondado para calcular o total anual: R$ 100 anuais mostram R$ 8,33
mensais e R$ 100 anuais. O valor original permanece separado da estimativa.

IOF e tarifas não são presumidos. Esses valores ainda não representam uma fatura
efetiva nem geram automaticamente AP/provisão/caixa. A mensagem incorreta que
afirmava essa integração foi corrigida. Registro de cobranças efetivas com câmbio
próprio e encargos posteriores permanece pendente em SAA-004.

## Compatibilidade e segurança

Migration Drizzle `0047_chubby_bastion.sql` adiciona campos e constraints à tabela
existente. Contratos antigos recebem BRL/mensal; seu `monthly_cost` é preservado
e usado como fallback. Nenhum backfill de caixa, remoção de dados ou mudança de
policies RLS. Migration aplicada nos bancos locais de uso e teste.

Cadastro/edição usam validação Zod, autorização SaaS existente e `finance.read`
para valores, contexto tenant/RLS, rate limit e auditoria na transação. Edição
bloqueia a assinatura por linha e respeita exclusão. Valores/cotação/data/fonte
não são serializados para perfis sem leitura financeira. A UI apresenta erros de
validação e impede reenvio enquanto salva. Sem novas credenciais ou uploads.

## Arquivos e testes

Schema/migration/snapshot/journal; regras, campos, formulário, actions e DAL SaaS;
lista/detalhe/cadastro de assinaturas; testes de regras, integração, migration e
E2E de moeda/periodicidade, cancelamento e remoção.

Testes cobrem EUR anual, USD sem cotação, BRL mensal/legado, arredondamento anual,
origem obrigatória da cotação, ocultação de custos, negação cross-tenant/RBAC,
payload adulterado e rollback de auditoria. Testes de migration verificam base
vazia, upgrade desde 0046 e preservação de RLS/valores legados.

Demais alterações locais e worktrees preexistentes foram preservadas. Não houve
merge em development/main nem marcação de SAA-001 como concluída.

## Resultados

Typecheck, lint e build aprovados. Suite unitária: 406 testes. Suite de banco:
199 testes, seguida de 4 testes focados após adicionar cobertura de valores BRL
e campos opcionais. E2Es de moeda/ciclo, cancelamento e remoção passaram. O teste
de moeda confirmou preservação dos campos após erro de validação, alteração da
cotação, USD sem cotação e anual BRL sem erro de arredondamento.
