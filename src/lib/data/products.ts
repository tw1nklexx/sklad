import type { ProductRow } from "@/lib/types"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin"

function normalizeProductRow(row: Record<string, unknown>): ProductRow {
  return {
    id: String(row.id),
    sku: String(row.sku ?? ""),
    name: String(row.name ?? ""),
    image_url:
      row.image_url != null && row.image_url !== ""
        ? String(row.image_url)
        : null,
    color:
      row.color != null && String(row.color).trim() !== ""
        ? String(row.color)
        : null,
    stock: Number(row.stock ?? 0),
    created_at: String(row.created_at ?? ""),
  }
}

export async function getProducts(): Promise<ProductRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()
  // select('*') — не падает, если колонки color ещё нет (миграция не применена)
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    console.error("[getProducts]", error.message, error)
    throw new Error("Не удалось загрузить товары")
  }
  return (data ?? []).map((row) =>
    normalizeProductRow(row as Record<string, unknown>)
  )
}
