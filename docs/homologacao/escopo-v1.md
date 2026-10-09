# Escopo V1 e critérios de aceite

Inclui clientes com/sem fee, fornecedores compartilhados, contas/categorias/centros
de custo, projetos, Gráfica completa, obrigações AR/AP, movimentações/conciliação,
correções/estornos, provisões/ciclos, comprovantes e relatórios. Autenticação, RBAC,
RLS, documentos, auditoria e pendências são dependências obrigatórias. Origens
NF/reembolso/SaaS entram apenas para garantir consistência financeira existente.

Fora: emissão de orçamento/OS/NF, OCR, envio de arte, integrações bancárias,
MRP, conclusão dos módulos RH/férias/admissões/desligamentos, mudanças estéticas.

## Invariantes

1. AR/AP são obrigações; caixa vem exclusivamente de movimentações confiáveis.
2. Conciliação aceita parcial e vários títulos, sem exceder saldos e sem duplicar.
3. Estorno preserva fatos/alocações e reabre saldos atomicamente, com motivo/audit.
4. Encerramento operacional não liquida obrigações.
5. Nenhuma entrada externa altera tenant, autorização ou valores derivados.
6. Histórico legado é preservado e identificado; não inventar caixa ou vínculo.
7. Documentos privados persistem após restart, com versões e download autorizado.

## Cenário obrigatório

Gestão cadastra cliente e fornecedor, cria trabalho e cotações, registra aprovação
interna, OS externa e decisão do cliente. Contratação cria AP e venda parcelada
cria AR exatamente uma vez. Duas artes finais ficam disponíveis. Produção passa
por bloqueio, retomada, entrega e encerramento. Financeiro registra entrada/saída,
concilia parcialmente/integralmente e múltiplos títulos. Gráfica, Cliente e
Financeiro exibem os mesmos valores. Estorno/correção indevida preserva histórico.
Perfis distintos verificam operações e documentos. Restart conserva DB e arquivos.
Importação histórica exige revisão explícita dos vínculos incertos.

## Gates e entregáveis

Typecheck, lint, unitários, `test:db -- --fileParallelism=false`, build e
`test:e2e -- --workers=1` devem passar em ambiente preparado/isolado. Falha
real, ambiente ou instabilidade será registrada; nenhuma aprovação com gate falho.
Entregar matriz final, problemas/correções, evidências reproduzíveis, manuais,
preparo do ambiente, fixtures fictícias/roteiro, limitações/riscos e SHA candidato.

