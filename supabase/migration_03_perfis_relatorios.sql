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
