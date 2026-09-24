-- Execute este arquivo no SQL Editor do Supabase antes de conectar o front-end.
create type public.app_role as enum ('admin', 'user', 'master');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  full_name text,
  unit text,
  email text,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  reference_id text,
  status text not null default 'rascunho' check (status in ('rascunho', 'concluido')),
  form_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventories_owner_id_idx on public.inventories(owner_id);
create index inventories_form_data_idx on public.inventories using gin(form_data);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'master')) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles(id, full_name, unit, email, role, must_change_password)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'unit',
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'user'),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  );
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger inventories_set_updated_at before update on public.inventories for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.inventories enable row level security;

-- Usuários comuns leem seus próprios perfis; Admins/Masters veem todos os perfis.
create policy "profiles own read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update using (id = auth.uid() or public.is_admin());
create policy "profiles insert" on public.profiles for insert with check (true);

-- Políticas de Inventários
create policy "inventories read isolated" on public.inventories for select using (owner_id = auth.uid() or public.is_admin());
create policy "inventories insert own" on public.inventories for insert with check (owner_id = auth.uid());
create policy "inventories update own" on public.inventories for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "inventories delete own" on public.inventories for delete using (owner_id = auth.uid() or public.is_admin());

-- Para promover o usuário da TI a Administrador / Master:
-- update public.profiles set role = 'admin', must_change_password = false where id = 'UUID_DO_USUARIO';

-- ==========================================================================
-- NOTIFICAÇÕES (caixa de entrada de envio/devolução de processos)
-- ==========================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid references public.inventories(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_scope text not null check (recipient_scope in ('user', 'managers')),
  type text not null check (type in ('submitted', 'returned')),
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx on public.notifications(recipient_scope, recipient_id);
create index if not exists notifications_inventory_idx on public.notifications(inventory_id);

alter table public.notifications enable row level security;

-- Cada usuário vê as notificações endereçadas a ele; gestores (admin/master)
-- veem também a caixa compartilhada "managers". "read" é compartilhado entre
-- os gestores nessa caixa (marcar como lida por um gestor limpa pra todos).
drop policy if exists "notifications select" on public.notifications;
create policy "notifications select" on public.notifications for select using (
  (recipient_scope = 'user' and recipient_id = auth.uid())
  or (recipient_scope = 'managers' and public.is_admin())
);

-- Um operador só pode notificar os gestores sobre um inventário do qual é dono;
-- um gestor só pode devolver notificando o próprio operador.
drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert with check (
  sender_id = auth.uid()
  and (
    (type = 'submitted' and recipient_scope = 'managers' and exists (
      select 1 from public.inventories i where i.id = inventory_id and i.owner_id = auth.uid()
    ))
    or
    (type = 'returned' and recipient_scope = 'user' and public.is_admin())
  )
);

drop policy if exists "notifications update read" on public.notifications;
create policy "notifications update read" on public.notifications for update using (
  (recipient_scope = 'user' and recipient_id = auth.uid())
  or (recipient_scope = 'managers' and public.is_admin())
) with check (true);

-- ==========================================================================
-- CONFIGURAÇÕES: e-mail no perfil (para listar usuários na tela de Gestão)
-- ==========================================================================
alter table public.profiles add column if not exists email text;

-- Preenche o e-mail dos perfis já existentes com base no cadastro de autenticação.
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles(id, full_name, unit, email, role, must_change_password)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'unit',
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.app_role, 'user'),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  );
  return new;
end; $$;

-- ==========================================================================
-- FUNDAÇÃO: UNIDADES, CICLOS E ESCOPO POR UNIDADE
-- ==========================================================================
-- Esta seção existe pra suportar o modelo "Ponto Focal (unidade) → Gestor
-- (aprova a unidade) → Encarregado/DPO (homologa a instituição inteira)".
-- Antes disso, "admin" enxergava TUDO (organização inteira). A partir daqui,
-- "admin" passa a ser "Gestor de uma unidade" (só vê a própria unidade) e
-- "encarregado" é quem tem visão de toda a instituição, junto com "master".
--
-- Compatibilidade: um perfil "admin" SEM unit_id definido continua vendo
-- tudo (comportamento antigo preservado) até alguém (master) atribuir uma
-- unidade a ele — nesse momento ele passa a ver só a própria unidade.

-- 1) Papel "encarregado": convertendo `role` de enum pra texto + check, pra
--    nunca mais esbarrar na trava do Postgres de "ALTER TYPE ... ADD VALUE"
--    dentro da mesma transação (o problema que geraria erro se tentássemos
--    só adicionar um valor no enum existente).
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;
alter table public.profiles alter column role set default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'admin', 'encarregado', 'master'));

-- O trigger de novo usuário não pode mais referenciar o enum public.app_role
-- (a coluna agora é texto); refazemos sem o cast.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles(id, full_name, unit, email, role, must_change_password)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'unit',
    new.email,
    coalesce(new.raw_user_meta_data ->> 'role', 'user'),
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  );
  return new;
end; $$;

-- 2) Unidades administrativas (SNEAR, SNELIS, Ouvidoria...)
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sigla text,
  created_at timestamptz not null default now()
);

-- Garante que a coluna existe antes de usá-la abaixo — em alguns bancos
-- ela pode ter ficado de fora de uma migração anterior.
alter table public.profiles add column if not exists unit text;
alter table public.profiles add column if not exists unit_id uuid references public.units(id);

-- Cria uma unidade pra cada valor de texto já usado em profiles.unit e em
-- inventories.form_data->>'unit', pra não perder o que já foi digitado.
insert into public.units (name)
select distinct trim(p.unit)
from public.profiles p
where p.unit is not null and trim(p.unit) <> ''
on conflict (name) do nothing;

insert into public.units (name)
select distinct trim(i.form_data ->> 'unit')
from public.inventories i
where i.form_data ->> 'unit' is not null and trim(i.form_data ->> 'unit') <> ''
on conflict (name) do nothing;

update public.profiles p
set unit_id = u.id
from public.units u
where p.unit_id is null and p.unit is not null and trim(p.unit) = u.name;

-- 3) Ciclos anuais de declaração
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  label text not null,
  deadline date,
  status text not null default 'aberto' check (status in ('aberto', 'encerrado')),
  created_at timestamptz not null default now()
);

insert into public.cycles (year, label, deadline)
select 2026, 'Ciclo 2026', date '2026-10-31'
where not exists (select 1 from public.cycles where year = 2026);

-- 4) Declaração de cada unidade em cada ciclo (o que a Ana/Encarregado
--    acompanha no "Painel do ciclo")
create table if not exists public.unit_declarations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  status text not null default 'nao_iniciada'
    check (status in ('nao_iniciada', 'em_preenchimento', 'em_homologacao', 'homologada')),
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  homologated_at timestamptz,
  homologated_by uuid references public.profiles(id),
  unique (unit_id, cycle_id)
);

-- 5) "Inventories" passam a ser as Operações de Tratamento: ganham unidade,
--    ciclo e o status de revisão ano-a-ano (mantido/alterado/encerrado/novo),
--    além de um link pra versão do ciclo anterior (pra "trazer" o item).
alter table public.inventories add column if not exists unit_id uuid references public.units(id);
alter table public.inventories add column if not exists cycle_id uuid references public.cycles(id);
alter table public.inventories add column if not exists item_status text not null default 'novo'
  check (item_status in ('mantido', 'alterado', 'encerrado', 'novo'));
alter table public.inventories add column if not exists change_description text;
alter table public.inventories add column if not exists closure_reason text;
alter table public.inventories add column if not exists closure_destination text;
alter table public.inventories add column if not exists previous_version_id uuid references public.inventories(id);

update public.inventories i
set unit_id = u.id
from public.units u
where i.unit_id is null and i.form_data ->> 'unit' is not null and trim(i.form_data ->> 'unit') = u.name;

update public.inventories
set cycle_id = (select id from public.cycles where year = 2026)
where cycle_id is null;

-- 6) Fontes de Dados: bancos, planilhas, arquivos físicos — rastreados
--    independentemente das operações, pra detectar "fonte órfã".
create table if not exists public.data_sources (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('banco_de_dados', 'planilha', 'arquivo_fisico', 'outro')),
  criticality text not null default 'media' check (criticality in ('alta', 'media', 'baixa')),
  item_status text not null default 'novo' check (item_status in ('mantido', 'alterado', 'encerrado', 'novo')),
  change_description text,
  closure_reason text,
  closure_destination text,
  previous_version_id uuid references public.data_sources(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists data_sources_set_updated_at on public.data_sources;
create trigger data_sources_set_updated_at before update on public.data_sources
  for each row execute procedure public.set_updated_at();

-- Vínculo entre operações e fontes de dados (muitos-pra-muitos). Uma fonte
-- sem nenhuma linha aqui é uma "fonte órfã".
create table if not exists public.operation_data_sources (
  operation_id uuid not null references public.inventories(id) on delete cascade,
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  primary key (operation_id, data_source_id)
);

-- 7) Compartilhamentos como item de ciclo de vida próprio (hoje isso também
--    existe solto dentro de inventories.form_data.sharing; essa tabela é a
--    versão "rastreável ano-a-ano" que as fases seguintes vão passar a usar).
create table if not exists public.sharings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  operation_id uuid references public.inventories(id) on delete set null,
  recipient_name text not null,
  legal_instrument text,
  item_status text not null default 'novo' check (item_status in ('mantido', 'alterado', 'encerrado', 'novo')),
  change_description text,
  closure_reason text,
  closure_destination text,
  previous_version_id uuid references public.sharings(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists sharings_set_updated_at on public.sharings;
create trigger sharings_set_updated_at before update on public.sharings
  for each row execute procedure public.set_updated_at();

-- 8) Colunas de uma fonte de dados, classificadas pelo ponto focal
--    (funcionalidade "Classificar colunas").
create table if not exists public.data_source_columns (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  column_name text not null,
  classification text,
  classified boolean not null default false,
  classified_by uuid references public.profiles(id),
  classified_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 9) Trilha de auditoria (quem fez o quê, quando) — usada nas telas de
--    Aprovação do gestor e no painel do Encarregado.
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units(id),
  cycle_id uuid references public.cycles(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_unit_idx on public.audit_log(unit_id, created_at desc);

-- 10) Funções de apoio pro RLS com escopo por unidade.
create or replace function public.is_org_wide()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('encarregado', 'master')) $$;

-- Gestor (admin) da unidade, ou alguém com visão da organização inteira.
-- Um admin sem unit_id definido ainda é tratado como "vê tudo" (compatível
-- com o comportamento anterior à criação de unidades).
create or replace function public.is_unit_manager(target_unit_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role in ('encarregado', 'master')
        or (role = 'admin' and (unit_id is null or unit_id = target_unit_id))
      )
  )
$$;

-- Ponto focal (ou qualquer perfil) que pertence à unidade em questão.
create or replace function public.is_unit_member(target_unit_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and unit_id = target_unit_id)
$$;

-- Atualiza as políticas de "inventories" pra considerar a unidade, mantendo
-- a regra antiga (is_admin) como rede de segurança pra registros legados
-- sem unit_id.
drop policy if exists "inventories read isolated" on public.inventories;
create policy "inventories read isolated" on public.inventories for select using (
  owner_id = auth.uid()
  or public.is_unit_manager(unit_id)
  or (unit_id is null and public.is_admin())
);

drop policy if exists "inventories delete own" on public.inventories;
create policy "inventories delete own" on public.inventories for delete using (
  owner_id = auth.uid()
  or public.is_unit_manager(unit_id)
  or (unit_id is null and public.is_admin())
);

-- 11) RLS das tabelas novas.
alter table public.units enable row level security;
alter table public.cycles enable row level security;
alter table public.unit_declarations enable row level security;
alter table public.data_sources enable row level security;
alter table public.operation_data_sources enable row level security;
alter table public.sharings enable row level security;
alter table public.data_source_columns enable row level security;
alter table public.audit_log enable row level security;

-- Unidades e ciclos: qualquer usuário logado lê (precisa pra dropdowns);
-- só quem tem visão da organização inteira cria/edita/remove.
drop policy if exists "units select all" on public.units;
create policy "units select all" on public.units for select using (auth.uid() is not null);
drop policy if exists "units write org wide" on public.units;
create policy "units write org wide" on public.units for all
  using (public.is_org_wide()) with check (public.is_org_wide());

drop policy if exists "cycles select all" on public.cycles;
create policy "cycles select all" on public.cycles for select using (auth.uid() is not null);
drop policy if exists "cycles write org wide" on public.cycles;
create policy "cycles write org wide" on public.cycles for all
  using (public.is_org_wide()) with check (public.is_org_wide());

-- Declaração da unidade: a própria unidade (ponto focal + gestor) e quem
-- tem visão da organização podem ver; só gestor da unidade ou organização
-- podem escrever (avançar o status).
drop policy if exists "unit_declarations select" on public.unit_declarations;
create policy "unit_declarations select" on public.unit_declarations for select using (
  public.is_unit_member(unit_id) or public.is_unit_manager(unit_id)
);
drop policy if exists "unit_declarations write" on public.unit_declarations;
create policy "unit_declarations write" on public.unit_declarations for all using (
  public.is_unit_manager(unit_id)
) with check (
  public.is_unit_manager(unit_id)
);

-- Fontes de dados, compartilhamentos e colunas: membros da unidade (ponto
-- focal) e gestor/organização podem ler e escrever; only gestor/organização
-- pode apagar de vez.
drop policy if exists "data_sources rw" on public.data_sources;
create policy "data_sources rw" on public.data_sources for all using (
  public.is_unit_member(unit_id) or public.is_unit_manager(unit_id)
) with check (
  public.is_unit_member(unit_id) or public.is_unit_manager(unit_id)
);

drop policy if exists "sharings rw" on public.sharings;
create policy "sharings rw" on public.sharings for all using (
  public.is_unit_member(unit_id) or public.is_unit_manager(unit_id)
) with check (
  public.is_unit_member(unit_id) or public.is_unit_manager(unit_id)
);

drop policy if exists "operation_data_sources rw" on public.operation_data_sources;
create policy "operation_data_sources rw" on public.operation_data_sources for all using (
  exists (
    select 1 from public.data_sources ds
    where ds.id = data_source_id
      and (public.is_unit_member(ds.unit_id) or public.is_unit_manager(ds.unit_id))
  )
) with check (
  exists (
    select 1 from public.data_sources ds
    where ds.id = data_source_id
      and (public.is_unit_member(ds.unit_id) or public.is_unit_manager(ds.unit_id))
  )
);

drop policy if exists "data_source_columns rw" on public.data_source_columns;
create policy "data_source_columns rw" on public.data_source_columns for all using (
  exists (
    select 1 from public.data_sources ds
    where ds.id = data_source_id
      and (public.is_unit_member(ds.unit_id) or public.is_unit_manager(ds.unit_id))
  )
) with check (
  exists (
    select 1 from public.data_sources ds
    where ds.id = data_source_id
      and (public.is_unit_member(ds.unit_id) or public.is_unit_manager(ds.unit_id))
  )
);

-- Auditoria: cada um só lê a trilha da própria unidade (ou tudo, se tiver
-- visão da organização); qualquer autenticado registra uma ação sua.
drop policy if exists "audit_log select" on public.audit_log;
create policy "audit_log select" on public.audit_log for select using (
  public.is_unit_member(unit_id) or public.is_unit_manager(unit_id) or unit_id is null
);
drop policy if exists "audit_log insert" on public.audit_log;
create policy "audit_log insert" on public.audit_log for insert with check (actor_id = auth.uid());

-- ==========================================================================
-- FASE 3: APROVAÇÃO DE DECLARAÇÃO PELO GESTOR
-- ==========================================================================
-- Permite ao gestor aprovar a declaração da unidade (avançando o status em
-- unit_declarations para "em_homologacao") e notificar o ponto focal disso.
-- O "devolver" já reaproveita o tipo de notificação "returned" que existe
-- desde a Fase 2 — só o "aprovado" é novo.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('submitted', 'returned', 'approved'));

drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications for insert with check (
  sender_id = auth.uid()
  and (
    (type = 'submitted' and recipient_scope = 'managers' and exists (
      select 1 from public.inventories i where i.id = inventory_id and i.owner_id = auth.uid()
    ))
    or
    (type in ('returned', 'approved') and recipient_scope = 'user' and public.is_admin())
  )
);


-- ==========================================================================
-- FASE 4: NÍVEIS DE ACESSO (Ponto Focal / Gestor / Master), PROTEÇÃO DE
--         PRIVILÉGIOS, VALIDAÇÃO DO FORMULÁRIO NO BANCO E "NÃO SE APLICA"
-- ==========================================================================
-- Seguro para rodar mais de uma vez. Não apaga nenhum usuário nem dado.
--
-- Migração dos perfis:
--   user (Operador de Dados)  -> ponto_focal
--   admin (Administrador)     -> gestor
--   encarregado (DPO)         -> master  (já tinha visão total e cadastrava usuários)
--   master                    -> master

-- 1) Papéis --------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using role::text;

update public.profiles set role = 'ponto_focal' where role = 'user';
update public.profiles set role = 'gestor' where role = 'admin';
update public.profiles set role = 'master' where role = 'encarregado';
update public.profiles set role = 'ponto_focal' where role is null or role not in ('ponto_focal', 'gestor', 'master');

-- Conta de bootstrap da TI continua sendo Master (antes isso era forçado pelo front-end).
update public.profiles p
set role = 'master', must_change_password = false
from auth.users u
where p.id = u.id and lower(u.email) = 'catzzrule65@gmail.com';

alter table public.profiles alter column role set default 'ponto_focal';
alter table public.profiles add constraint profiles_role_check
  check (role in ('ponto_focal', 'gestor', 'master'));

-- 2) Funções de autorização (usadas por todas as políticas RLS) ----------
create or replace function public.is_master()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'master') $$;

-- Gestor ou Master.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('gestor', 'master')) $$;

create or replace function public.is_org_wide()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_master() $$;

-- Master vê qualquer unidade. Gestor vê a própria unidade; um gestor sem
-- unidade definida continua vendo tudo (compatibilidade com o modelo antigo).
create or replace function public.is_unit_manager(target_unit_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'master'
        or (role = 'gestor' and (unit_id is null or unit_id = target_unit_id))
      )
  )
$$;

-- 3) Novo usuário: sempre nasce Ponto Focal -------------------------------
-- O papel NUNCA vem dos metadados enviados pelo navegador; só o Master altera.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  insert into public.profiles(id, full_name, unit, email, role, must_change_password)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    null,
    new.email,
    'ponto_focal',
    coalesce((new.raw_user_meta_data ->> 'must_change_password')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end; $$;

-- 4) Proteção de privilégios em profiles ---------------------------------
-- Só o Master altera perfil de acesso, unidade ou e-mail (de qualquer um,
-- inclusive o próprio). Sem usuário autenticado (SQL Editor, trigger de
-- cadastro do Auth) a alteração é permitida.
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_master() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.id <> auth.uid() then
      raise exception 'Somente o Master pode criar perfis de outros usuários.';
    end if;
    new.role := 'ponto_focal';
    new.unit_id := null;
    return new;
  end if;

  if new.id <> auth.uid() then
    raise exception 'Somente o Master pode alterar dados de outros usuários.';
  end if;

  if new.role is distinct from old.role
     or new.unit_id is distinct from old.unit_id
     or new.unit is distinct from old.unit
     or new.email is distinct from old.email then
    raise exception 'Somente o Master pode alterar perfil de acesso, unidade ou e-mail.';
  end if;

  return new;
end; $$;

drop trigger if exists profiles_guard_privileges on public.profiles;
create trigger profiles_guard_privileges before insert or update on public.profiles
  for each row execute procedure public.guard_profile_privileges();

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid() or public.is_master())
  with check (id = auth.uid() or public.is_master());

drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert
  with check (id = auth.uid() or public.is_master());

-- 5) Inventários: unidade/ciclo definidos pelo banco ----------------------
-- A unidade vem sempre do dono do inventário (não do navegador), e o ciclo
-- é o ciclo aberto. Só o Master pode mover um inventário de unidade/dono.
create or replace function public.inventories_set_scope()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  owner_unit uuid;
  open_cycle uuid;
begin
  select unit_id into owner_unit from public.profiles where id = new.owner_id;
  select id into open_cycle from public.cycles where status = 'aberto' order by year desc limit 1;

  if auth.uid() is not null and not public.is_master() then
    if tg_op = 'INSERT' then
      new.unit_id := owner_unit;
    else
      new.owner_id := old.owner_id;
      new.unit_id := coalesce(old.unit_id, owner_unit);
      new.cycle_id := coalesce(old.cycle_id, new.cycle_id);
    end if;
  end if;

  new.unit_id := coalesce(new.unit_id, owner_unit);
  new.cycle_id := coalesce(new.cycle_id, open_cycle);
  return new;
end; $$;

drop trigger if exists inventories_set_scope on public.inventories;
create trigger inventories_set_scope before insert or update on public.inventories
  for each row execute procedure public.inventories_set_scope();

-- Inventários antigos sem unidade herdam a unidade do dono.
update public.inventories i
set unit_id = p.unit_id
from public.profiles p
where i.owner_id = p.id and i.unit_id is null and p.unit_id is not null;

-- Gestor/Master podem atualizar inventários da unidade (necessário para
-- "Devolver" — antes a RLS bloqueava silenciosamente essa atualização).
drop policy if exists "inventories update own" on public.inventories;
create policy "inventories update own" on public.inventories for update
  using (owner_id = auth.uid() or public.is_unit_manager(unit_id) or (unit_id is null and public.is_admin()))
  with check (owner_id = auth.uid() or public.is_unit_manager(unit_id) or (unit_id is null and public.is_admin()));

-- 6) Validação do formulário no banco, com "Não se aplica" --------------
-- form_data.not_applicable é uma lista com as chaves dos campos marcados
-- como "Não se aplica". Um campo obrigatório é válido se estiver preenchido
-- OU marcado como "Não se aplica".
create or replace function public.inventory_field_answered(fd jsonb, field_key text)
returns boolean language sql immutable
as $$
  select coalesce(fd -> 'not_applicable', '[]'::jsonb) ? field_key
      or (jsonb_typeof(fd -> field_key) = 'array' and jsonb_array_length(fd -> field_key) > 0)
      or (jsonb_typeof(fd -> field_key) = 'string' and length(btrim(fd ->> field_key)) > 0)
$$;

create or replace function public.validate_inventory_completion()
returns trigger language plpgsql set search_path = public
as $$
declare
  fd jsonb := coalesce(new.form_data, '{}'::jsonb);
  na jsonb := coalesce(new.form_data -> 'not_applicable', '[]'::jsonb);
  missing text[] := '{}';
  field_key text;
begin
  -- Só valida na passagem para "concluido" (registros antigos já concluídos
  -- continuam editáveis sem esbarrar em campos criados depois).
  if new.status <> 'concluido' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'concluido' then
    return new;
  end if;

  if length(btrim(coalesce(new.title, ''))) = 0 then
    missing := array_append(missing, 'Nome do serviço/processo');
  end if;
  if length(btrim(coalesce(new.reference_id, ''))) = 0 and not (na ? 'reference_id') then
    missing := array_append(missing, 'reference_id');
  end if;

  foreach field_key in array array[
    'system_name', 'created_at', 'unit',
    'controller_name', 'controller_email', 'controller_phone',
    'dpo_name', 'dpo_email', 'operator_name',
    'lifecycle', 'flow', 'geography', 'data_source',
    'legal_basis', 'purpose', 'data_categories', 'retention_period',
    'data_subjects', 'security'
  ] loop
    if not public.inventory_field_answered(fd, field_key) then
      missing := array_append(missing, field_key);
    end if;
  end loop;

  if not (na ? 'security') and length(btrim(coalesce(fd ->> 'security', ''))) between 1 and 14 then
    missing := array_append(missing, 'security (mínimo de 15 caracteres)');
  end if;

  if coalesce(array_length(missing, 1), 0) > 0 then
    raise exception 'Formulário incompleto: preencha ou marque "Não se aplica" em: %', array_to_string(missing, ', ')
      using errcode = 'check_violation';
  end if;

  return new;
end; $$;

drop trigger if exists inventories_validate_completion on public.inventories;
create trigger inventories_validate_completion before insert or update on public.inventories
  for each row execute procedure public.validate_inventory_completion();

-- 7) Declaração da unidade: o Ponto Focal pode ENVIAR, não aprovar ----------
-- Antes o Ponto Focal era bloqueado pela RLS ao clicar em "Enviar para
-- aprovação". Agora ele pode criar/enviar a declaração da própria unidade,
-- mas só Gestor/Master avançam para aprovada/homologada.
drop policy if exists "unit_declarations member insert" on public.unit_declarations;
create policy "unit_declarations member insert" on public.unit_declarations for insert
  with check (public.is_unit_member(unit_id));

drop policy if exists "unit_declarations member update" on public.unit_declarations;
create policy "unit_declarations member update" on public.unit_declarations for update
  using (public.is_unit_member(unit_id))
  with check (public.is_unit_member(unit_id));

create or replace function public.guard_unit_declaration()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.is_unit_manager(new.unit_id) then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status in ('em_homologacao', 'homologada') then
    raise exception 'A declaração já foi aprovada e não pode mais ser alterada pelo Ponto Focal.';
  end if;
  if new.status not in ('nao_iniciada', 'em_preenchimento') then
    raise exception 'Somente o Gestor ou o Master podem aprovar ou homologar a declaração.';
  end if;
  if new.submitted_by is not null and new.submitted_by <> auth.uid() then
    raise exception 'O envio deve ser registrado em nome de quem está enviando.';
  end if;

  if tg_op = 'INSERT' then
    new.approved_at := null;
    new.approved_by := null;
    new.homologated_at := null;
    new.homologated_by := null;
  else
    new.unit_id := old.unit_id;
    new.cycle_id := old.cycle_id;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
    new.homologated_at := old.homologated_at;
    new.homologated_by := old.homologated_by;
  end if;
  return new;
end; $$;

drop trigger if exists unit_declarations_guard on public.unit_declarations;
create trigger unit_declarations_guard before insert or update on public.unit_declarations
  for each row execute procedure public.guard_unit_declaration();

-- 8) Trilha de auditoria: sem vazamento entre unidades ----------------------
drop policy if exists "audit_log select" on public.audit_log;
create policy "audit_log select" on public.audit_log for select using (
  public.is_unit_member(unit_id)
  or public.is_unit_manager(unit_id)
  or (unit_id is null and public.is_admin())
);

drop policy if exists "audit_log insert" on public.audit_log;
create policy "audit_log insert" on public.audit_log for insert with check (
  actor_id = auth.uid()
  and (unit_id is null or public.is_unit_member(unit_id) or public.is_unit_manager(unit_id))
);
