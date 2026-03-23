-- Склад: товары (SKU, фото) и история списаний

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null,
  name text not null,
  image_url text,
  stock integer not null default 0,
  created_at timestamptz not null default now(),
  constraint products_name_unique unique (name),
  constraint products_sku_unique unique (sku)
);

create table if not exists public.inventory_updates (
  id uuid primary key default gen_random_uuid(),
  raw_text text not null,
  parsed_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_updates_created_at_idx
  on public.inventory_updates (created_at desc);

insert into public.products (sku, name, image_url, stock) values
  (
    'VEN-001',
    'веник черный',
    'https://images.unsplash.com/photo-1585421514288-efb74c2b95d2?w=200&h=200&fit=crop&q=80',
    42
  ),
  (
    'VEN-002',
    'совок',
    'https://images.unsplash.com/photo-1610552050890-df61a89c3843?w=200&h=200&fit=crop&q=80',
    73
  ),
  (
    'VEN-003',
    'ершик',
    'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=200&h=200&fit=crop&q=80',
    19
  ),
  (
    'VEN-004',
    'ведро',
    'https://images.unsplash.com/photo-1581578949510-fa7315c4c3ab?w=200&h=200&fit=crop&q=80',
    56
  ),
  (
    'VEN-005',
    'швабра',
    'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=200&h=200&fit=crop&q=80',
    91
  )
on conflict (name) do update set
  sku = excluded.sku,
  image_url = coalesce(excluded.image_url, public.products.image_url),
  stock = excluded.stock;

create or replace function public.apply_stock_update(
  p_raw_text text,
  p_parsed_snapshot jsonb,
  p_deductions jsonb,
  p_allow_negative boolean
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

  for rec in
    select *
    from jsonb_to_recordset(p_deductions) as t(product_id uuid, total_quantity integer)
  loop
    if rec.total_quantity is null or rec.total_quantity <= 0 then
      raise exception 'invalid quantity';
    end if;

    update public.products
    set stock = stock - rec.total_quantity
    where id = rec.product_id
    returning stock into v_stock;

    if not found then
      raise exception 'product not found';
    end if;

    if v_stock < 0 and not p_allow_negative then
      raise exception 'negative stock not allowed';
    end if;
  end loop;

  insert into public.inventory_updates (raw_text, parsed_json)
  values (p_raw_text, p_parsed_snapshot)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.apply_stock_update(text, jsonb, jsonb, boolean) from public;
grant execute on function public.apply_stock_update(text, jsonb, jsonb, boolean) to service_role;
