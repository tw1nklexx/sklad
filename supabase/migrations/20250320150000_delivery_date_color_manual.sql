-- Дата отвоза в истории, цвет товара, RPC со датой и атомарное ручное сохранение

alter table public.inventory_updates
  add column if not exists delivery_date date;

alter table public.products
  add column if not exists color text;

update public.products set color = 'Чёрный' where name = 'веник черный' and color is null;
update public.products set color = 'Серый' where name = 'совок' and color is null;
update public.products set color = 'Белый' where name = 'ершик' and color is null;
update public.products set color = 'Синий' where name = 'ведро' and color is null;
update public.products set color = 'Зелёный' where name = 'швабра' and color is null;

drop function if exists public.apply_stock_update(text, jsonb, jsonb, boolean);

create or replace function public.apply_stock_update(
  p_raw_text text,
  p_parsed_snapshot jsonb,
  p_deductions jsonb,
  p_allow_negative boolean,
  p_delivery_date date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_stock int;
  v_id uuid;
begin
  if p_raw_text is null or length(trim(p_raw_text)) = 0 then
    raise exception 'empty raw text';
  end if;

  if p_delivery_date is null then
    raise exception 'delivery date required';
  end if;

  for rec in
    select *
    from jsonb_to_recordset(p_deductions) as t(product_id uuid, quantity integer)
  loop
    if rec.quantity is null or rec.quantity <= 0 then
      raise exception 'invalid quantity';
    end if;

    update public.products
    set stock = stock - rec.quantity
    where id = rec.product_id
    returning stock into v_stock;

    if not found then
      raise exception 'product not found';
    end if;

    if v_stock < 0 and not p_allow_negative then
      raise exception 'negative stock not allowed';
    end if;
  end loop;

  insert into public.inventory_updates (raw_text, parsed_json, delivery_date)
  values (p_raw_text, p_parsed_snapshot, p_delivery_date)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_stock_update(text, jsonb, jsonb, boolean, date) from public;
grant execute on function public.apply_stock_update(text, jsonb, jsonb, boolean, date) to service_role;

-- Ручное изменение остатков: обновление строк + одна запись истории (транзакция)
create or replace function public.apply_manual_stock_update(
  p_raw_text text,
  p_parsed_snapshot jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
  v_id uuid;
begin
  if p_raw_text is null or length(trim(p_raw_text)) = 0 then
    raise exception 'empty raw text';
  end if;

  for rec in
    select *
    from jsonb_to_recordset(
      p_parsed_snapshot->'changes'
    ) as t(product_id uuid, became integer)
  loop
    if rec.became is null then
      raise exception 'invalid stock';
    end if;

    update public.products
    set stock = rec.became
    where id = rec.product_id;

    if not found then
      raise exception 'product not found';
    end if;
  end loop;

  insert into public.inventory_updates (raw_text, parsed_json, delivery_date)
  values (p_raw_text, p_parsed_snapshot, null)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_manual_stock_update(text, jsonb) from public;
grant execute on function public.apply_manual_stock_update(text, jsonb) to service_role;
