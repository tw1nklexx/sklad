-- Демо-товары: SKU, название, цвет, фото, остаток

insert into public.products (sku, name, color, image_url, stock) values
  (
    'VEN-001',
    'веник черный',
    'Чёрный',
    'https://images.unsplash.com/photo-1585421514288-efb74c2b95d2?w=200&h=200&fit=crop&q=80',
    42
  ),
  (
    'VEN-002',
    'совок',
    'Серый',
    'https://images.unsplash.com/photo-1610552050890-df61a89c3843?w=200&h=200&fit=crop&q=80',
    73
  ),
  (
    'VEN-003',
    'ершик',
    'Белый',
    'https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=200&h=200&fit=crop&q=80',
    19
  ),
  (
    'VEN-004',
    'ведро',
    'Синий',
    'https://images.unsplash.com/photo-1581578949510-fa7315c4c3ab?w=200&h=200&fit=crop&q=80',
    56
  ),
  (
    'VEN-005',
    'швабра',
    'Зелёный',
    'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=200&h=200&fit=crop&q=80',
    91
  )
on conflict (name) do update set
  sku = excluded.sku,
  color = coalesce(excluded.color, public.products.color),
  image_url = coalesce(excluded.image_url, public.products.image_url),
  stock = excluded.stock;
