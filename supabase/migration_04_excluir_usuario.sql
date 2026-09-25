-- ==========================================================================
-- FASE 5: EXCLUSÃO DE USUÁRIOS PELO MASTER
-- ==========================================================================
-- Só o Master exclui. Os inventários do usuário excluído NÃO são apagados:
-- passam para outro usuário escolhido (o inventário pertence à área, não à
-- pessoa). As colunas "quem fez" (auditoria, declarações, fontes de dados,
-- compartilhamentos) ficam vazias, e a exclusão é registrada na auditoria
-- com o e-mail do usuário removido. Seguro para rodar mais de uma vez.

create or replace function public.admin_delete_user(target_user uuid, transfer_to uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
declare
  target_email text;
  target_unit uuid;
  moved integer;
begin
  if not public.is_master() then
    raise exception 'Somente o Master pode excluir usuários.';
  end if;
  if target_user = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio usuário.';
  end if;

  select email, unit_id into target_email, target_unit from public.profiles where id = target_user;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  if transfer_to is null or transfer_to = target_user
     or not exists (select 1 from public.profiles where id = transfer_to) then
    raise exception 'Escolha outro usuário para receber os inventários.';
  end if;

  update public.inventories set owner_id = transfer_to where owner_id = target_user;
  get diagnostics moved = row_count;

  update public.audit_log set actor_id = null where actor_id = target_user;
  update public.unit_declarations set submitted_by = null where submitted_by = target_user;
  update public.unit_declarations set approved_by = null where approved_by = target_user;
  update public.unit_declarations set homologated_by = null where homologated_by = target_user;
  update public.data_sources set created_by = null where created_by = target_user;
  update public.sharings set created_by = null where created_by = target_user;
  update public.data_source_columns set created_by = null where created_by = target_user;
  update public.data_source_columns set classified_by = null where classified_by = target_user;

  insert into public.audit_log(unit_id, actor_id, action, entity_type, entity_id, detail)
  values (
    target_unit,
    auth.uid(),
    'user_deleted',
    'profile',
    null,
    format('Usuário %s excluído. %s inventário(s) transferido(s).', coalesce(target_email, target_user::text), moved)
  );

  -- Apaga o login; o perfil e as notificações saem junto (on delete cascade).
  delete from auth.users where id = target_user;
end; $$;

revoke execute on function public.admin_delete_user(uuid, uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid, uuid) to authenticated;
