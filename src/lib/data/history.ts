import type { InventoryUpdateRow, ParsedSnapshot } from "@/lib/types"
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin"

function normalizeUpdateRow(row: Record<string, unknown>): InventoryUpdateRow {
  return {
    id: String(row.id),
    raw_text: String(row.raw_text ?? ""),
    parsed_json: (row.parsed_json ?? { lines: [] }) as ParsedSnapshot,
    delivery_date:
      row.delivery_date != null && String(row.delivery_date).trim() !== ""
        ? String(row.delivery_date).slice(0, 10)
        : null,
    created_at: String(row.created_at ?? ""),
  }
}

export async function getInventoryUpdates(): Promise<InventoryUpdateRow[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("inventory_updates")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[getInventoryUpdates]", error.message, error)
    throw new Error("Не удалось загрузить историю")
  }
  return (data ?? []).map((row) =>
    normalizeUpdateRow(row as Record<string, unknown>)
  )
}
