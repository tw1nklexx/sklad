-- Fix: align apply_stock_update column names with the deployed DB function.
--
-- Root cause: the deployed function reads `total_quantity` from p_deductions
-- via jsonb_to_recordset, but the TypeScript code sent `quantity`.
-- Result: rec.total_quantity = NULL → stock - NULL = NULL → NOT NULL violation.
--
-- This migration ensures the local SQL matches the live function contract.
-- The TypeScript fix is in buildDeductionsPayload → sends total_quantity.

-- Also: ensure stock column safety
update public.products set stock = 0 where stock is null;
alter table public.products alter column stock set default 0;
alter table public.products alter column stock set not null;

-- Recreate apply_stock_update: p_deductions expects { product_id, total_quantity }
drop function if exists public.apply_stock_update(text, jsonb, jsonb, boolean, date);

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
    from jsonb_to_recordset(p_deductions) as t(product_id uuid, total_quantity integer)
  loop
    if rec.total_quantity is null or rec.total_quantity <= 0 then
      raise exception 'invalid quantity';
    end if;

    update public.products
    set stock = coalesce(stock, 0) - rec.total_quantity
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
