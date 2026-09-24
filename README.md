# Inventário LGPD

Plataforma web de governança de dados: substitui as cópias manuais da aba `3.0 Templete` de planilha por formulários de inventário de tratamento de dados pessoais, com login, papéis de acesso, controle de risco e fluxo de aprovação entre operadores e gestores.

## Stack

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript |
| UI | React 18 (function components + hooks, sem Redux/Router) |
| Build/dev server | Vite 6 |
| Estilos | CSS puro (`src/styles.css`), sem framework (não usa Tailwind) |
| Ícones | [lucide-react](https://lucide.dev) |
| Backend / banco | [Supabase](https://supabase.com) (Postgres + Auth + RLS), acessado via `@supabase/supabase-js` |
| Deploy | GitHub Pages, automático via GitHub Actions (`.github/workflows/deploy.yml`) a cada push em `main`/`master` |

Não há back-end próprio: todo acesso a dados é feito diretamente do front-end para o Supabase, protegido por Row Level Security (RLS) no banco — por isso as regras de permissão vivem em `supabase/schema.sql`, não em código de servidor.

## Como rodar localmente

1. Crie um projeto no [Supabase](https://supabase.com), abra o **SQL Editor** e execute o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) de cima a baixo (é seguro rodar mais de uma vez — os comandos usam `if not exists` / `drop policy if exists`).
2. Copie `.env.example` para `.env` e preencha com a URL e a chave **anon pública** do seu projeto Supabase. **Nunca** use a chave `service_role` no front-end.
3. Instale as dependências e suba o servidor de desenvolvimento:

   ```bash
   npm install
   npm run dev
   ```

4. Promova o primeiro usuário a Master rodando no SQL Editor `update public.profiles set role = 'master', must_change_password = false where email = 'SEU_EMAIL';`. O papel **nunca** é deduzido do e-mail: todo cadastro novo nasce `ponto_focal` (trigger `handle_new_user`) e só o Master muda perfis, em Configurações → Usuários e permissões. (No modo demonstração offline, sem Supabase, o e-mail ainda escolhe o perfil — só para testar a interface.)

Scripts disponíveis: `npm run dev`, `npm run build` (`tsc -b && vite build`), `npm run preview`.

## Estrutura do projeto

```
src/
  main.tsx                     # App raiz: sessão, roteamento por estado (não usa react-router) e todas as chamadas ao Supabase
  supabase.ts                  # Cria o client do Supabase a partir das env vars
  styles.css                   # Todo o CSS do projeto (um arquivo só, organizado por seções comentadas)
  types/inventory.ts           # Tipos centrais: Inventory, UserProfile, ManagedProfile, AppNotification, FormData...
  utils/
    lgpdRisk.ts                 # Regras de classificação de risco (roda 100% no cliente, sem IA)
    exportCsv.ts                 # Geração do CSV consolidado (Guia 3 SGD/MGI)
    roles.ts                     # Perfis (ponto_focal/gestor/master): rótulos e regras de acesso do front
  components/
    auth/                      # Login, criação/troca de senha, cadastro de usuário (gestor)
    dashboard/                 # Shell pós-login: Sidebar, header, notificações, configurações, listagem
      InicioPanel.tsx           # Tela "Início" do ponto focal (progresso do ciclo, avisos)
      DeclaracaoPanel.tsx       # "Minha Declaração": operações, fontes de dados, compartilhamentos
      AprovacoesPanel.tsx       # Tela de aprovação (Gestor e Master)
      RelatoriosPanel.tsx       # Dashboard "Relatórios" (Gestor e Master), só com dados reais do banco
    inventory/                 # Formulário multi-etapas de um inventário de processo
      SharingTable.tsx / TransferTable.tsx / ContractsTable.tsx  # Tabelas repetíveis (seções 11/13/14)
    common/                    # Componentes pequenos reaproveitados (ex.: RiskBadge)
    ui/                        # Componentes visuais genéricos (ex.: BorderBeam)
supabase/schema.sql            # Única fonte de verdade do banco: tabelas, RLS, triggers, policies
.github/workflows/deploy.yml   # Build + publish em GitHub Pages a cada push na main
```

`main.tsx` não usa um roteador — é uma máquina de estados simples que decide qual tela renderizar (`LoginView`, `ForcePasswordChangeView`, `InventoryFormView` ou `DashboardView`) com base no `user` e no `editing` atuais.

## Papéis de acesso

Definidos em `profiles.role` (coluna `text` com `check`): `ponto_focal`, `gestor`, `master`. A migração [`supabase/migration_03_perfis_relatorios.sql`](supabase/migration_03_perfis_relatorios.sql) converteu os valores antigos sem apagar ninguém: `user` → `ponto_focal`, `admin` → `gestor`, `encarregado`/`master` → `master`. O front ainda aceita os nomes antigos (`normalizeRole()` em `utils/roles.ts`) para não quebrar se o banco estiver atrasado.

| Perfil | O que faz | Onde é garantido |
|---|---|---|
| **Ponto Focal** (antigo Operador de Dados) | Cria/edita os próprios inventários, preenche e envia a declaração da própria unidade. Não vê Relatórios nem Aprovações. Não muda o próprio perfil nem a própria unidade. | RLS de `inventories`/`unit_declarations` + triggers `guard_profile_privileges` e `guard_unit_declaration` |
| **Gestor** (antigo Admin) | Vê os dados dos Pontos Focais da sua unidade (Gestor sem unidade vê todas), aprova/devolve declarações, devolve inventários, acessa o Dashboard. | `is_unit_manager()` nas policies |
| **Master** (antigo Gestor/Encarregado) | Tudo do Gestor em todas as unidades + cadastrar usuários, alterar nome/perfil/unidade, enviar link de redefinição de senha, exigir troca de senha. | `is_master()` nas policies e no trigger de perfis |

Não existem rotas por URL (o app é uma máquina de estados), então não há como "pular" para uma tela digitando o endereço; mesmo assim, cada tela restrita tem um guarda no `DashboardView` e **toda** leitura/escrita passa pela RLS do Supabase — chamar a API direto com o token de um Ponto Focal não devolve dados de outras unidades nem permite mudar o próprio perfil.

## Fluxos principais

**Ciclo anual**: a tabela `cycles` guarda o ciclo aberto no momento (ex.: "Ciclo 2026", com prazo) — carregado uma vez em `loadCurrentCycle()` e mostrado no cabeçalho com contagem regressiva. Cada unidade tem uma linha em `unit_declarations` por ciclo, com status `nao_iniciada → em_preenchimento → em_homologacao → homologada`.

**Inventário de processo (Operação de Tratamento)**: ponto focal clica em "Novo Inventário" → preenche o formulário multi-etapas (`InventoryFormView`) → salva como rascunho (`status: 'rascunho'`) quantas vezes quiser → ao clicar em concluir, o front valida os campos obrigatórios e grava `status: 'concluido'`. Também existem `data_sources` (fontes de dados) e `sharings` (compartilhamentos) como entidades próprias, cada uma com um `item_status` (`novo`/`alterado`/`encerrado`/`mantido`) pra rastrear mudanças ciclo a ciclo — hoje tudo nasce `novo` porque ainda não existe um ciclo anterior de verdade.

**Minha Declaração → Aprovação → Homologação**: o ponto focal revisa os itens da unidade em "Minha Declaração" (`DeclaracaoPanel`) e clica em "Enviar para aprovação do gestor" (grava `submitted_at`/`submitted_by` em `unit_declarations`). O gestor vê isso na tela "Aprovações" (`AprovacoesPanel`) — quantidade de itens por status, o que mudou, diagnóstico de risco agregado (reaproveita `riskReport()`) — e pode **aprovar** (avança pra `em_homologacao`) ou **devolver** com uma observação obrigatória (limpa o `submitted_at`, manda notificação `type: 'returned'` pro ponto focal). Quando há várias unidades aguardando, o Gestor sem unidade e o Master escolhem a área num seletor no topo da tela. A homologação final ainda não tem tela própria.

**Notificações (caixa de entrada)**: tabela `notifications` com três tipos — `submitted` (processo enviado, endereçado a todos os gestores), `returned` (devolvido, com mensagem obrigatória) e `approved` (declaração aprovada). Mostradas pelo sino no cabeçalho e nos cards de "Início". Protegidas por RLS (`schema.sql`), não por lógica de front-end.

**Configurações**: aba "Meu Perfil" (nome e senha; a unidade só é editável pelo Master) e, só para o Master, "Usuários e permissões" (cadastrar, editar nome/perfil/unidade, enviar link de redefinição de senha por e-mail, exigir troca de senha no próximo acesso). O Master não altera o próprio perfil. A senha em si nunca é vista por ninguém — redefinir é sempre por link do Supabase Auth.

**Relatórios (Dashboard)**: menu "Relatórios", visível só para Gestor e Master (`RelatoriosPanel`). Tudo vem das tabelas `inventories`, `unit_declarations`, `units`, `cycles`, `audit_log` e `profiles` — nada é fictício. Filtros: ciclo, área, periodicidade (campo 9.1 agrupado em faixas) e período (data de criação). Mostra % de áreas que concluíram, áreas pendentes, formulários concluídos/rascunhos, risco alto, situação de cada área, formulários por área, respostas por mês, periodicidade, nível de risco, tabela por área e histórico. Cada gráfico tem "Ver dados em tabela". O botão "Atualizar dados" recarrega do banco.

**"Não se aplica"**: os campos de texto do formulário (e as tabelas das seções 11, 13 e 14) têm uma caixa "Não se aplica". Marcada, o campo é limpo, fica desabilitado exibindo "Não se aplica" e deixa de ser obrigatório. A marcação é salva em `inventories.form_data.not_applicable` (lista com as chaves dos campos). Assim dá para distinguir: preenchido (tem valor), não se aplica (chave na lista) e pendente (sem valor e fora da lista). O CSV e a listagem mostram "Não se aplica" escrito. A regra "obrigatório = preenchido ou marcado" existe no front (`validationErrors`) e no banco (trigger `validate_inventory_completion`, que recusa gravar `status = 'concluido'` com pendências).

**Classificação de risco**: `utils/lgpdRisk.ts` calcula o nível de risco (`alto`/`medio`/`baixo`) e os motivos (`riskReport()`) localmente, a partir de regras fixas (dados sensíveis, ausência de base legal, prazo de retenção, compartilhamento com terceiros, transferência internacional). Não chama nenhuma IA/API externa — isso é intencional, ver `.env.example` e a seção de segurança abaixo.

## De onde vêm os campos do formulário

O formulário digitaliza o **Guia 3 SGD/MGI**, o modelo oficial de inventário de dados pessoais da Secretaria de Governo Digital — a planilha está em [`docs/GUIA_INVENTARIO_DE_DADOS___TEMPLETE.xlsx`](docs/GUIA_INVENTARIO_DE_DADOS___TEMPLETE.xlsx). Ela sozinha **não é suficiente** pra recriar o formulário (tem seções sem lista de valores, e o sistema acrescentou campos técnicos que ela não prevê) — [`docs/CAMPOS-DO-INVENTARIO.md`](docs/CAMPOS-DO-INVENTARIO.md) tem o mapa completo: cada seção numerada da planilha ligada ao campo correspondente no código, quais são obrigatórios, e o que o sistema teve que definir por conta própria. Leitura obrigatória antes de mexer no formulário ou nas 28 colunas do CSV exportado.

## Banco de dados (Supabase)

Tudo em [`supabase/schema.sql`](supabase/schema.sql), executado manualmente no SQL Editor (não há migration runner configurado). Principais tabelas:

- `profiles` — 1 linha por usuário autenticado (`auth.users`), criada automaticamente pelo trigger `handle_new_user`. Tem `unit_id` (referência a `units`) desde a Fase 1.
- `units` — unidades administrativas (SNEAR, Ouvidoria, TI...). Criada automaticamente a partir dos textos livres já usados em `profiles.unit`/`inventories.form_data.unit`.
- `cycles` — ciclos anuais de declaração (ex.: "Ciclo 2026").
- `unit_declarations` — status da declaração de cada unidade em cada ciclo (rascunho → em preenchimento → em homologação → homologada), com quem enviou/aprovou/homologou e quando.
- `inventories` — um registro por Operação de Tratamento; `owner_id` isola o acesso via RLS, `unit_id`/`cycle_id` escopam por unidade/ciclo, `item_status`/`closure_reason`/`closure_destination` rastreiam mudança ano a ano.
- `data_sources` / `sharings` — Fontes de Dados e Compartilhamentos como entidades próprias (mesmo modelo de ciclo de vida do `inventories`), ligadas a uma unidade e um ciclo.
- `data_source_columns` — colunas de uma fonte de dados a classificar (funcionalidade "Classificar colunas", ainda não construída na UI).
- `audit_log` — trilha de quem fez o quê (envio/aprovação/devolução de declaração, devolução de inventário, cadastro e alteração de usuários); aparece no "Histórico" do Dashboard.
- `notifications` — caixa de entrada de envio/devolução/aprovação (ver fluxo acima).

O arquivo tem uma seção por "fase" de desenvolvimento (procure os cabeçalhos `-- FASE N`), cada uma pensada pra ser executada isoladamente (não precisa rodar o arquivo inteiro de novo). Ao alterar o schema, **edite `schema.sql` e documente a mudança como um bloco novo no final do arquivo**, com `if not exists`/`drop policy if exists`, para que o arquivo inteiro continue seguro de re-executar em um banco que já tem dados — e, se for algo que o usuário vai colar direto no SQL Editor, considere também salvar como um `supabase/migration_NN_nome.sql` avulso (evita erro de seleção de linha ao copiar só o trecho novo).

## Deploy

Push em `main` (ou `master`) dispara `.github/workflows/deploy.yml`: instala dependências, roda `npm run build` e publica `dist/` no GitHub Pages. O `base` do Vite é fixo em `/Sistema-Iventario-de-Dados-/` ([`vite.config.ts`](vite.config.ts)) — se o nome do repositório mudar, atualize esse valor também.

As env vars do Supabase têm um fallback hardcoded em `src/supabase.ts` (projeto de demonstração) para o app nunca quebrar sem configuração — em um fork real, defina `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` como secrets do repositório para sobrescrever esse fallback no build de produção.

## Segurança adotada

- Autenticação e RLS do Supabase fazem o isolamento de dados — a UI nunca é a única barreira.
- O verificador de risco roda 100% no cliente; nenhuma resposta de formulário é enviada a uma IA.
- Exportação de CSV aparece para Gestor e Master; gestão de usuários só para o Master (e o banco bloqueia mudança de perfil feita por qualquer outro usuário).

## Antes de ir pra produção de verdade

- Exija MFA, configure domínio de redirecionamento de auth e revise as policies no painel do Supabase.
- Restrinja quem tem papel `gestor`/`master` e mantenha auditoria de acesso.
- Faça uma avaliação formal com o encarregado/DPO — o verificador de risco é uma triagem automatizada, não um parecer jurídico.
- Se for integrar IA no futuro, envie só metadados anonimizados, por um serviço de back-end — nunca com uma chave secreta exposta no navegador.
