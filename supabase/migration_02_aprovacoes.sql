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
