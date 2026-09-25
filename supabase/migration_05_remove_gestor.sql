-- ==========================================================================
-- FASE 6: PERFIL GESTOR UNIFICADO AO MASTER
-- ==========================================================================
-- Decisão do stakeholder: o Gestor fazia o mesmo que o Master. Ficam só dois
-- perfis: ponto_focal e master. Quem era gestor vira master (nenhum usuário é
-- apagado). Seguro para rodar mais de uma vez.

alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'master' where role in ('gestor', 'admin', 'encarregado');
update public.profiles set role = 'ponto_focal' where role is null or role not in ('ponto_focal', 'master');
alter table public.profiles add constraint profiles_role_check
  check (role in ('ponto_focal', 'master'));

-- As políticas continuam chamando is_admin()/is_unit_manager(); agora ambas
-- significam "é Master".
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_master() $$;

create or replace function public.is_unit_manager(target_unit_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_master() $$;
