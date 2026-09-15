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

