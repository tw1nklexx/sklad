import { HistoryList } from "@/components/history-list"
import { getInventoryUpdates } from "@/lib/data/history"
import { getProducts } from "@/lib/data/products"
import { isSupabaseConfigured } from "@/lib/supabase/admin"
import type { InventoryUpdateRow, ProductRow } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HistoryPage() {
  const ready = isSupabaseConfigured()
  let updates: InventoryUpdateRow[] = []
  let products: ProductRow[] = []
  let loadError: string | null = null

  if (ready) {
    try {
      updates = await getInventoryUpdates()
    } catch {
      loadError =
        "Не удалось загрузить историю. Проверьте ключи Supabase и наличие таблиц."
    }
    try {
      products = await getProducts()
    } catch {
      products = []
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">История</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Все операции: дата отвоза, время записи и подробный разбор.
        </p>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : null}

      {!ready ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
          Подключите Supabase, чтобы видеть историю.
        </div>
      ) : (
        <HistoryList updates={updates} products={products} />
      )}
    </div>
  )
}
