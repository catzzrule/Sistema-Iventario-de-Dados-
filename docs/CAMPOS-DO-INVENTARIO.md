# De onde vêm os campos do formulário

Este sistema digitaliza o **[Guia 3 SGD/MGI](GUIA_INVENTARIO_DE_DADOS___TEMPLETE.xlsx)** — o modelo oficial de inventário de dados pessoais da Secretaria de Governo Digital, usado pelos órgãos do SISP. A planilha (aba `3.0 Templete`) é a referência de conteúdo; este documento existe porque **a planilha sozinha não é suficiente** para reconstruir o formulário: ela tem seções sem lista de valores (aba `4-Listas` vem vazia) e o sistema acrescentou campos técnicos que a planilha não prevê. Leia isto antes de tentar recriar o formulário do zero.

## Como ler a planilha

- **`1-Orientações`** — explica o propósito do inventário e como as abas se relacionam. Vale ler antes do resto.
- **`2-Lista Inventário`** — índice geral (um resumo de todos os processos/serviços da instituição). No sistema, isso é a **tabela do dashboard** (`DashboardView`), não uma tela própria.
- **`3.0 Templete`** — o formulário em si, dividido em 14 seções numeradas. É a aba mais importante: cada seção virou uma etapa do formulário (`InventoryFormView.tsx`).
- **`4-Listas`** — na planilha oficial ela **vem em branco** (só os cabeçalhos: Garantias, Riscos de Privacidade, Hipóteses de Tratamento, Medidas de Segurança...). O texto de orientação da própria planilha admite isso: cada instituição preenche do seu jeito. O sistema resolveu isso de duas formas — ver seção "O que a planilha não define" abaixo.

## Mapa: seção da planilha → campo no sistema

Cada linha abaixo é: **nº da seção na planilha** → **rótulo mostrado no formulário** → **nome do campo salvo no banco** (`Inventory.form_data.<campo>`, tipado em [`src/types/inventory.ts`](../src/types/inventory.ts)). Campos sem "campo no banco" ficam soltos em `Inventory` (não dentro de `form_data`).

| Seção da planilha | Campo no formulário | Campo salvo | Obrigatório? |
|---|---|---|---|
| *(não numerado)* | Sistema / Plataforma | `system_name` | Sim |
| *(não numerado)* | Como o sistema foi desenvolvido | `system_development` | Não |
| *(não numerado)* | Arquitetura do sistema | `system_architecture` | Não |
| *(não numerado)* | Onde o sistema é hospedado | `system_hosting` | Não |
| *(não numerado)* | Data de início de operação do sistema | `system_start_date` | Não |
| 1.1 | Nome do Serviço / Processo | `Inventory.title` | Sim |
| 1.2 | Nº Referência / ID | `Inventory.reference_id` | Sim |
| 1.3 | Data de Criação do Inventário | `created_at` | Sim |
| 1.4 | Data de Atualização | `Inventory.updated_at` (preenchido pelo banco, não é digitado) | — |
| 1.5 | *(não existe na planilha, adicionado pelo sistema)* Unidade / Departamento | `unit` | Sim |
| 2.1 | Controlador (nome, e-mail, telefone) | `controller_name`, `controller_email`, `controller_phone` | Sim |
| 2.2 | Encarregado / DPO (nome, e-mail) | `dpo_name`, `dpo_email` | Sim |
| 2.3 | Operador | `operator_name` | Sim |
| 3.1 | Fases do Ciclo de Vida (Coleta, Retenção, Processamento, Compartilhamento, Eliminação) | `lifecycle` (array) | Sim (≥1) |
| 3.1 "Em qual fase..." | Descrição de em qual fase o Operador atua | `lifecycle_description` | Não |
| 4.1 | Descrição do fluxo de tratamento | `flow` | Sim |
| 5.1 | Abrangência geográfica | `geography` | Sim |
| 5.2 | Fonte de coleta dos dados | `data_source` | Sim |
| 6.1 | Hipótese legal / Base legal (Art. 7º/11º) | `legal_basis` | Sim |
| 6.2 | Finalidade específica | `purpose` | Sim |
| 6.3 | Previsão legal | `legal_provision` | Não |
| 6.4 | Resultados pretendidos para o titular | `expected_results` | Não |
| 6.5 | Benefícios esperados para o órgão/sociedade | `expected_benefits` | Não |
| 7.x | Categorias de Dados Pessoais (as ~40 subcategorias da planilha viraram grupos de chips — ver `categoryGroups` em [`lgpdRisk.ts`](../src/utils/lgpdRisk.ts)) | `data_categories` (array) | Sim (≥1) |
| 7.x "Descrição" | Descrição dos dados coletados nessas categorias | `data_categories_description` | Não |
| 7.x | Tempo de retenção | `retention_period` | Sim |
| 7.x | Nome da Base de Dados | `database` | Não |
| 8.x | Categorias de Dados Sensíveis (Art. 5º, II) | `sensitive_categories` (array, lista fixa em `sensitiveCategories` no `lgpdRisk.ts`) | Não (mas afeta o risco) |
| 8.x "Descrição" | Descrição dos dados sensíveis coletados | `sensitive_categories_description` | Não |
| 9.1 | Frequência do tratamento | `frequency` | Não |
| 9.2 | Quantidade de titulares | `data_volume` | Não |
| 10.1 / 10.2 | Descrição dos grupos de titulares | `data_subjects` | Sim |
| 10.3 | Trata dados de crianças e adolescentes | `vulnerable_groups` inclui `'criancas'` | Não |
| 10.4 | Trata dados de outros grupos vulneráveis | `vulnerable_groups` inclui `'vulneraveis'` | Não |
| 11.x | Compartilhamento com terceiros (instituição, dados, finalidade) | `sharing` (array de `{ institution, data, purpose }`, editado no componente [`SharingTable`](../src/components/inventory/SharingTable.tsx)) | Não |
| 12.x | Tipo de medida de segurança e privacidade | `security_type` | Não |
| 12.1 | Descrição do(s) controle(s) de segurança | `security` | Sim (mín. 15 caracteres) |
| 13.x | Transferência internacional (país, dados, garantia) — uma linha por organização | `international_transfers` (array de `{ country, data, guarantee }`, editado no componente [`TransferTable`](../src/components/inventory/TransferTable.tsx)) | Não |
| 14.x | Contrato(s) de TI (nº processo, objeto, e-mail do gestor) — uma linha por contrato | `contracts_list` (array de `{ number, object, managerEmail }`, editado no componente [`ContractsTable`](../src/components/inventory/ContractsTable.tsx)) | Não |
| — | *(campos legados, mantidos só para não perder dados de inventários salvos antes dessa mudança — a UI migra o texto automaticamente pra dentro da primeira linha da tabela na primeira edição)* | `international_transfer`, `contracts` | — |
| — | *(campo do tipo, sem uso no formulário atual)* | `updated_on` | — |

## O que a planilha não define (e como o sistema resolveu)

A aba `4-Listas` do template oficial vem **sem valores** — só os títulos das colunas (Garantias, Riscos de Privacidade, Hipóteses de Tratamento, Medidas de Segurança, Fonte de Retenção, etc.). Isso é intencional no modelo da SGD (cada órgão adapta), mas significa que **você não vai achar essas listas prontas na planilha**. O sistema tratou isso de duas formas, dependendo do campo:

1. **Virou lista fixa no código**, quando fazia sentido padronizar:
   - `sensitiveCategories` e `categoryGroups` em [`src/utils/lgpdRisk.ts`](../src/utils/lgpdRisk.ts) — as 10 categorias sensíveis (Art. 5º, II) e os grupos de dados comuns da seção 7, viraram *chips* clicáveis em vez de dropdown.
   - As opções de "Como o sistema foi desenvolvido" / arquitetura / hospedagem (seção não-numerada, específica de TI) estão hardcoded como `<option>` dentro de [`InventoryFormView.tsx`](../src/components/inventory/InventoryFormView.tsx) (linhas ~407-446) — são específicas do órgão de origem do projeto, ajuste livremente para o seu contexto.

2. **Virou campo de texto livre com um `placeholder` de exemplo**, quando a variedade de respostas é grande demais pra uma lista fechada — é o caso de `legal_basis`, `security`, `security_type` e das linhas de `international_transfers`/`contracts_list`. Se seu órgão preferir dropdown fechado nesses campos, você precisa criar essa lista de valores do zero (a planilha, como vimos, não traz uma pronta).

Se for reconstruir o sistema, **decida essas listas de valores antes de montar as telas** — é a parte que mais gera retrabalho se deixada pra depois.

## Validação: quando um processo pode ser marcado como "Concluído"

A função `validateForm()` em `InventoryFormView.tsx` é a lista oficial de campos obrigatórios (coluna "Obrigatório?" da tabela acima reflete exatamente essas regras). Um processo salvo como rascunho pode ficar incompleto; só ao clicar em "Concluir" essas validações são checadas — se faltar algo, o formulário pula direto pra aba com o erro.

## Exportação CSV: as 28 colunas do relatório

O botão "Exportar Planilha (.CSV)" (só para gestores) gera um CSV com exatamente 28 colunas, na ordem definida em [`src/utils/exportCsv.ts`](../src/utils/exportCsv.ts) — é basicamente a tabela acima "achatada" em uma linha por processo, mais duas colunas calculadas no fim (nível de risco e diagnóstico, gerados por `riskReport()` em `lgpdRisk.ts`). Se for alterar os campos do formulário, lembre de atualizar esse arquivo também — ele não deriva automaticamente do tipo `FormData`.
