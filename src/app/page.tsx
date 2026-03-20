import { WarehouseClient } from "@/components/warehouse-client"
import { getProducts } from "@/lib/data/products"
import { isSupabaseConfigured } from "@/lib/supabase/admin"
import type { ProductRow } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const ready = isSupabaseConfigured()
  let products: ProductRow[] = []
  let loadError: string | null = null

  if (ready) {
    try {
      products = await getProducts()
    } catch {
      loadError =
        "Не удалось загрузить данные. Проверьте ключи Supabase и наличие таблиц."
    }
  }

  return (
    <WarehouseClient
      products={products}
      supabaseReady={ready}
      loadError={loadError}
    />
  )
}
