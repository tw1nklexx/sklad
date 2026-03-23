# Склад — учёт остатков

Внутренний инструмент на **Next.js (App Router)** + **Supabase**: таблица остатков, модальное списание по свободному тексту (парсер), история операций. Интерфейс полностью на **русском**.

## Стек

- Next.js 16, React 19, TypeScript  
- Tailwind CSS 4, shadcn/ui (Base UI)  
- Supabase (PostgreSQL), серверный доступ через **service role**  
- React Hook Form, Zod, TanStack Table  

## Структура проекта

```
src/
  app/                 # «Склад» /, «История» /history (/products → редирект на /)
  actions/             # Списание по тексту + ручное сохранение
  components/          # UI и экранные блоки
  lib/
    data/              # Загрузка из Supabase
    parser.ts          # Разбор текста отгрузки
    stock-preview.ts   # Сопоставление с каталогом
    supabase/          # Клиент с service role
supabase/migrations/   # Схема БД, RPC, демо-данные
scripts/seed.sql       # Повторная заливка демо-товаров (опционально)
```

## Настройка Supabase

1. Создайте проект в [Supabase](https://supabase.com).  
2. В **Project Settings → API** скопируйте **Project URL** и **service_role** ключ (`secret`).  
3. В корне репозитория:

```bash
cp .env.example .env.local
```

Заполните:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Важно:** ключ `service_role` используется только на сервере (Server Actions и RSC). Не встраивайте его в клиентский код и не публикуйте.

4. Откройте **SQL Editor** в Supabase и выполните содержимое файла:

`supabase/migrations/20250320120000_init.sql`

Либо используйте [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref <ref>
supabase db push
```

После миграции в таблице `products` появятся демо-товары с **SKU**, **фото** и остатками.

Если проект создавался по старой схеме (без `sku` / `image_url`), выполните  
`supabase/migrations/20250320140000_upgrade_legacy_products.sql`.

Для **даты отвоза**, **цвета товара**, **ручных правок** и обновлённых RPC выполните  
`supabase/migrations/20250320150000_delivery_date_color_manual.sql`.

Для колонки **PDF штрихкода** (`barcode_pdf_url`):  
`supabase/migrations/20250320160000_barcode_pdf_url.sql`  
(файлы кладите в `public/barcodes`, в БД — путь вида `/barcodes/SKU.pdf`).

Если товары с `stock = NULL` (ошибка при списании):  
`supabase/migrations/20250320170000_fix_null_stock.sql`  
— обнуляет NULL, восстанавливает NOT NULL + DEFAULT, обновляет RPC с `COALESCE`.

Повторный сид: `scripts/seed.sql`.

## Запуск

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Формат текста списания (строгий)

Каждая непустая строка:

`N коробка|коробки|коробок - наименование Q [, наименование Q …]`

- **N** — число коробок в строке.  
- После тире — позиции через запятую; в каждой позиции **целое число в конце** — количество **на одну коробку**.  
- **Итого по позиции** = `N × (число в конце)`.  
- По всем строкам одинаковые наименования **суммируются**.  
- Сопоставление с каталогом: нормализация пробелов и регистра, **точное** совпадение с полем `name` в БД.

## Правила подтверждения списания

- Если есть **не найденные** позиции — строки подсвечиваются, кнопка **Подтвердить** отключена.  
- Если после списания был бы **отрицательный остаток** — предупреждение и чекбокс **Разрешить отрицательный остаток**.  
- На сервере текст **перепарсируется** и снова валидируется перед вызовом RPC `apply_stock_update` (транзакция: обновление остатков + запись в `inventory_updates` с **датой отвоза** `delivery_date`).

## Сборка

```bash
npm run build
npm start
```

Без `.env.local` приложение собирается и показывает баннер настройки; таблицы остаются пустыми до подключения БД.
