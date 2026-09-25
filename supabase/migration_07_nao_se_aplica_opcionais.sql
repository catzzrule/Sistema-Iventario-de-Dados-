-- ==========================================================================
-- FASE 8: "NÃO SE APLICA" SÓ NAS PERGUNTAS OPCIONAIS
-- ==========================================================================
-- Os campos obrigatórios precisam de valor para o inventário ser enviado;
-- marcar "Não se aplica" neles não conta mais como resposta. Registros já
-- enviados não são alterados (a validação só roda na passagem para
-- "concluido"). Seguro para rodar mais de uma vez.

create or replace function public.inventory_field_filled(fd jsonb, field_key text)
returns boolean language sql immutable set search_path = public
as $$
  -- coalesce: campo ausente no JSON daria null (e passaria na validação).
  select coalesce(
    (jsonb_typeof(fd -> field_key) = 'array' and jsonb_array_length(fd -> field_key) > 0)
    or (jsonb_typeof(fd -> field_key) = 'string' and length(btrim(fd ->> field_key)) > 0),
    false)
$$;

create or replace function public.validate_inventory_completion()
returns trigger language plpgsql set search_path = public
as $$
declare
  fd jsonb := coalesce(new.form_data, '{}'::jsonb);
  missing text[] := '{}';
  field_key text;
begin
  if new.status <> 'concluido' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'concluido' then
    return new;
  end if;

  if length(btrim(coalesce(new.title, ''))) = 0 then
    missing := array_append(missing, 'Nome do serviço/processo');
  end if;
  if length(btrim(coalesce(new.reference_id, ''))) = 0 then
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
    if not public.inventory_field_filled(fd, field_key) then
      missing := array_append(missing, field_key);
    end if;
  end loop;

  if length(btrim(coalesce(fd ->> 'security', ''))) between 1 and 14 then
    missing := array_append(missing, 'security (mínimo de 15 caracteres)');
  end if;

  if coalesce(array_length(missing, 1), 0) > 0 then
    raise exception 'Formulário incompleto: preencha os campos obrigatórios: %', array_to_string(missing, ', ')
      using errcode = 'check_violation';
  end if;

  return new;
end; $$;
