-- Обновление схемы, если уже применена старая миграция без sku / image_url

alter table public.products add column if not exists sku text;
alter table public.products add column if not exists image_url text;

update public.products
set
  sku = 'VEN-001',
  image_url = coalesce(
    image_url,
    'https://images.unsplash.com/photo-1585421514288-efb74c2b95d2?w=200&h=200&fit=crop&q=80'
  )
where name = 'веник черный' and sku is null;

update public.products
set
  sku = 'VEN-002',
  image_url = coalesce(
    image_url,
    'https://images.unsplash.com/photo-1610552050890-df61a89c3843?w=200&h=200&fit=crop&q=80'
  )
where name = 'совок' and sku is null;

update public.products
set
  sku = 'VEN-003',
  image_url = coalesce(
    image_url,
    'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=200&h=200&fit=crop&q=80'
  )
where name = 'ершик' and sku is null;

update public.products
set
  sku = 'VEN-004',
  image_url = coalesce(
    image_url,
    'https://images.unsplash.com/photo-1581578949510-fa7315c4c3ab?w=200&h=200&fit=crop&q=80'
  )
where name = 'ведро' and sku is null;

update public.products
set
  sku = 'VEN-005',
  image_url = coalesce(
    image_url,
    'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=200&h=200&fit=crop&q=80'
  )
where name = 'швабра' and sku is null;

update public.products
set sku = 'SKU-' || replace(id::text, '-', '')
where sku is null;

alter table public.products alter column stock set default 0;
alter table public.products alter column sku set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'products'
      and c.conname = 'products_sku_unique'
  ) then
    alter table public.products
      add constraint products_sku_unique unique (sku);
  end if;
end $$;
