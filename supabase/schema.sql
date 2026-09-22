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

