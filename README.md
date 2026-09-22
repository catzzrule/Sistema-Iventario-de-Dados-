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

4. Promova o primeiro usuário a `master`/`admin` rodando o `update` comentado no fim do `schema.sql`, ou faça login com um e-mail que contenha `master`, `admin` ou `dpo` — veja `getRoleForEmail()` em [`src/main.tsx`](src/main.tsx) (regra de conveniência para ambiente de desenvolvimento; em produção o papel real vem da tabela `profiles`).

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
  components/
    auth/                      # Login, criação/troca de senha, cadastro de usuário (gestor)
    dashboard/                 # Shell pós-login: Sidebar, header, notificações, configurações, listagem
    inventory/                 # Formulário multi-etapas de um inventário de processo
    common/                    # Componentes pequenos reaproveitados (ex.: RiskBadge)
    ui/                        # Componentes visuais genéricos (ex.: BorderBeam)
supabase/schema.sql            # Única fonte de verdade do banco: tabelas, RLS, triggers, policies
.github/workflows/deploy.yml   # Build + publish em GitHub Pages a cada push na main
```

`main.tsx` não usa um roteador — é uma máquina de estados simples que decide qual tela renderizar (`LoginView`, `ForcePasswordChangeView`, `InventoryFormView` ou `DashboardView`) com base no `user` e no `editing` atuais.

## Papéis de acesso

Definidos em `profiles.role` (enum `app_role` no Postgres): `user`, `admin`, `master`.

- **`user` (Operador de Dados)** — cria e edita seus próprios inventários (`owner_id`), só vê os próprios registros (garantido por RLS, não só pela UI).
- **`admin` (Gestor/DPO)** e **`master` (TI)** — tratados como "gestor" em quase todo o código (helper `isManagerProfile()` em `main.tsx` e `isManager` recalculado em cada componente); veem todos os inventários, matriz de risco, exportam CSV, cadastram usuários e podem devolver processos.
- O e-mail fixo `catzzrule65@gmail.com` é tratado como master "hardcoded" em vários pontos (`MASTER_TI_EMAILS`) — histórico de bootstrap do projeto, não remova sem entender o impacto no primeiro acesso.

## Fluxos principais

**Inventário de processo**: operador clica em "Novo Inventário" → preenche o formulário multi-etapas (`InventoryFormView`) → salva como rascunho (`status: 'rascunho'`) quantas vezes quiser → ao clicar em concluir, o front valida os campos obrigatórios e grava `status: 'concluido'`.

**Notificações (caixa de entrada)**: ao marcar um inventário como `concluido` pela primeira vez, `main.tsx` insere uma linha na tabela `notifications` (`type: 'submitted'`, endereçada a todos os gestores). Um gestor pode "Devolver" um processo concluído (botão na tabela do dashboard) escrevendo uma mensagem — isso volta o `status` para `rascunho` e cria uma notificação `type: 'returned'` para o dono do processo. Tudo isso é protegido por RLS (veja a seção de notificações em `schema.sql`), não por lógica de front-end.

**Configurações**: tela com abas "Meu Perfil" (trocar nome/unidade/senha) e "Usuários" (gestor cadastra novos acessos e vê a lista de quem já tem conta — usa a coluna `profiles.email`, adicionada depois da criação inicial da tabela).

**Classificação de risco**: `utils/lgpdRisk.ts` calcula o nível de risco (`alto`/`medio`/`baixo`) e os motivos (`riskReport()`) localmente, a partir de regras fixas (dados sensíveis, ausência de base legal, prazo de retenção, compartilhamento com terceiros, transferência internacional). Não chama nenhuma IA/API externa — isso é intencional, ver `.env.example` e a seção de segurança abaixo.

## De onde vêm os campos do formulário

O formulário digitaliza o **Guia 3 SGD/MGI**, o modelo oficial de inventário de dados pessoais da Secretaria de Governo Digital — a planilha está em [`docs/GUIA_INVENTARIO_DE_DADOS___TEMPLETE.xlsx`](docs/GUIA_INVENTARIO_DE_DADOS___TEMPLETE.xlsx). Ela sozinha **não é suficiente** pra recriar o formulário (tem seções sem lista de valores, e o sistema acrescentou campos técnicos que ela não prevê) — [`docs/CAMPOS-DO-INVENTARIO.md`](docs/CAMPOS-DO-INVENTARIO.md) tem o mapa completo: cada seção numerada da planilha ligada ao campo correspondente no código, quais são obrigatórios, e o que o sistema teve que definir por conta própria. Leitura obrigatória antes de mexer no formulário ou nas 28 colunas do CSV exportado.

## Banco de dados (Supabase)

Tudo em [`supabase/schema.sql`](supabase/schema.sql), executado manualmente no SQL Editor (não há migration runner configurado). Principais tabelas:

- `profiles` — 1 linha por usuário autenticado (`auth.users`), criada automaticamente pelo trigger `handle_new_user`.
- `inventories` — um registro por processo de tratamento de dados; `owner_id` isola o acesso via RLS.
- `notifications` — caixa de entrada de envio/devolução (ver fluxo acima).

Ao alterar o schema, **edite `schema.sql` e documente a mudança como um bloco novo no final do arquivo** (padrão já usado nas seções "NOTIFICAÇÕES" e "CONFIGURAÇÕES"), com `if not exists`/`drop policy if exists`, para que o arquivo inteiro continue seguro de re-executar em um banco que já tem dados.

## Deploy

Push em `main` (ou `master`) dispara `.github/workflows/deploy.yml`: instala dependências, roda `npm run build` e publica `dist/` no GitHub Pages. O `base` do Vite é fixo em `/Sistema-Iventario-de-Dados-/` ([`vite.config.ts`](vite.config.ts)) — se o nome do repositório mudar, atualize esse valor também.

As env vars do Supabase têm um fallback hardcoded em `src/supabase.ts` (projeto de demonstração) para o app nunca quebrar sem configuração — em um fork real, defina `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` como secrets do repositório para sobrescrever esse fallback no build de produção.

## Segurança adotada

- Autenticação e RLS do Supabase fazem o isolamento de dados — a UI nunca é a única barreira.
- O verificador de risco roda 100% no cliente; nenhuma resposta de formulário é enviada a uma IA.
- Exportação de CSV e gestão de usuários só aparecem para papéis de gestor.

## Antes de ir pra produção de verdade

- Exija MFA, configure domínio de redirecionamento de auth e revise as policies no painel do Supabase.
- Restrinja quem tem papel `admin`/`master` e mantenha auditoria de acesso.
- Faça uma avaliação formal com o encarregado/DPO — o verificador de risco é uma triagem automatizada, não um parecer jurídico.
- Se for integrar IA no futuro, envie só metadados anonimizados, por um serviço de back-end — nunca com uma chave secreta exposta no navegador.
