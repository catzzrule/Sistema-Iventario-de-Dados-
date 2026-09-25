-- ==========================================================================
-- FASE 7: ESTEIRA DE APROVAÇÃO POR INVENTÁRIO E MASTER SOMENTE LEITURA
-- ==========================================================================
-- Status do inventário:
--   rascunho  -> só o Ponto Focal dono vê e edita
--   concluido -> enviado pelo Ponto Focal, aguardando aprovação do Master
--   aprovado  -> aprovado pelo Master
-- O Master não cria, não edita e não apaga inventários: só visualiza os que
-- foram enviados, aprova ou devolve (volta para rascunho).
-- Seguro para rodar mais de uma vez. Não apaga dados.

-- 1) Unidade do inventário: do dono; se o dono não tem unidade, usa a
--    unidade digitada no campo 1.5, quando ela bate com uma unidade cadastrada.
create or replace function public.inventories_set_scope()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  owner_unit uuid;
  typed_unit uuid;
  open_cycle uuid;
begin
  -- Só o Master transfere o dono (usado na exclusão de usuário).
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_master() then
    new.owner_id := old.owner_id;
  end if;

  select unit_id into owner_unit from public.profiles where id = new.owner_id;
  select id into typed_unit from public.units
   where lower(btrim(name)) = lower(btrim(coalesce(new.form_data ->> 'unit', '')))
   limit 1;
  select id into open_cycle from public.cycles where status = 'aberto' order by year desc limit 1;

  -- A unidade nunca vem do navegador.
  if tg_op = 'UPDATE' then
    new.cycle_id := coalesce(old.cycle_id, new.cycle_id);
    new.unit_id := coalesce(owner_unit, typed_unit, old.unit_id);
  else
    new.unit_id := coalesce(owner_unit, typed_unit);
  end if;

  new.cycle_id := coalesce(new.cycle_id, open_cycle);
  return new;
end; $$;

-- Vincula inventários antigos sem unidade (dono ou texto digitado), sem
-- mexer na data de atualização deles.
alter table public.inventories disable trigger inventories_set_updated_at;

update public.inventories i
set unit_id = coalesce(
  (select p.unit_id from public.profiles p where p.id = i.owner_id),
  (select u.id from public.units u where lower(btrim(u.name)) = lower(btrim(coalesce(i.form_data ->> 'unit', ''))) limit 1)
)
where i.unit_id is null;

update public.inventories i
set cycle_id = (select id from public.cycles where status = 'aberto' order by year desc limit 1)
where i.cycle_id is null;

alter table public.inventories enable trigger inventories_set_updated_at;

-- 2) Regras de status e bloqueio de edição pelo Master.
alter table public.inventories drop constraint if exists inventories_status_check;
alter table public.inventories add constraint inventories_status_check
  check (status in ('rascunho', 'concluido', 'aprovado'));

create or replace function public.guard_inventory_changes()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if new.status not in ('rascunho', 'concluido', 'aprovado') then
    raise exception 'Status de inventário inválido: %', new.status;
  end if;

  if public.is_master() then
    if tg_op = 'INSERT' then
      raise exception 'O Master não cria inventários.';
    end if;
    if new.title is distinct from old.title
       or new.reference_id is distinct from old.reference_id
       or new.form_data is distinct from old.form_data
       or new.item_status is distinct from old.item_status
       or new.change_description is distinct from old.change_description
       or new.closure_reason is distinct from old.closure_reason
       or new.closure_destination is distinct from old.closure_destination then
      raise exception 'O Master não pode editar o conteúdo do inventário, apenas aprovar ou devolver.';
    end if;
    if new.status is distinct from old.status
       and not ((old.status = 'concluido' and new.status in ('aprovado', 'rascunho'))
                or (old.status = 'aprovado' and new.status = 'rascunho')) then
      raise exception 'Transição de status não permitida para o Master.';
    end if;
    return new;
  end if;

  -- Ponto Focal: nunca aprova o próprio inventário.
  if new.status = 'aprovado' and (tg_op = 'INSERT' or old.status is distinct from 'aprovado') then
    raise exception 'Somente o Master pode aprovar inventários.';
  end if;
  -- Alterou um inventário já aprovado: precisa ser enviado de novo.
  if tg_op = 'UPDATE' and old.status = 'aprovado' and new.status = 'aprovado'
     and (new.form_data is distinct from old.form_data
          or new.title is distinct from old.title
          or new.reference_id is distinct from old.reference_id) then
    raise exception 'Inventário aprovado alterado: salve como rascunho ou envie novamente.';
  end if;
  return new;
end; $$;

drop trigger if exists inventories_guard_changes on public.inventories;
create trigger inventories_guard_changes before insert or update on public.inventories
  for each row execute procedure public.guard_inventory_changes();

revoke execute on function public.guard_inventory_changes() from public, anon, authenticated;
revoke execute on function public.inventories_set_scope() from public, anon, authenticated;

-- 3) RLS: o Master não enxerga rascunhos; ninguém além do dono cria/apaga.
drop policy if exists "inventories read isolated" on public.inventories;
create policy "inventories read isolated" on public.inventories for select using (
  owner_id = auth.uid()
  or (public.is_master() and status <> 'rascunho')
);

drop policy if exists "inventories insert own" on public.inventories;
create policy "inventories insert own" on public.inventories for insert
  with check (owner_id = auth.uid() and not public.is_master());

drop policy if exists "inventories update own" on public.inventories;
create policy "inventories update own" on public.inventories for update
  using (owner_id = auth.uid() or (public.is_master() and status <> 'rascunho'))
  with check (owner_id = auth.uid() or public.is_master());

drop policy if exists "inventories delete own" on public.inventories;
create policy "inventories delete own" on public.inventories for delete
  using (owner_id = auth.uid() and not public.is_master());

-- 4) Resumo de rascunhos para os relatórios do Master: só contagens por
--    unidade/ciclo, sem expor o conteúdo dos rascunhos.
create or replace function public.inventory_draft_summary()
returns table(unit_id uuid, cycle_id uuid, drafts bigint, last_update timestamptz)
language sql stable security definer set search_path = public
as $$
  select i.unit_id, i.cycle_id, count(*), max(i.updated_at)
  from public.inventories i
  where i.status = 'rascunho' and public.is_master()
  group by i.unit_id, i.cycle_id
$$;

revoke execute on function public.inventory_draft_summary() from public, anon;
grant execute on function public.inventory_draft_summary() to authenticated;
