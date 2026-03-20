"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import type { ManualChangeRow, ParsedSnapshot } from "@/lib/types"

const itemSchema = z.object({
  id: z.string().uuid(),
  stock: z.number().int(),
})

const saveSchema = z.object({
  items: z.array(itemSchema).min(1, "Нет строк для сохранения"),
})

export type ManualSaveResult =
  | { ok: true }
  | { ok: false; message: string }

/**
 * Ручное сохранение без RPC: не зависит от функции apply_manual_stock_update
 * и от порядка миграций. История — только raw_text + parsed_json; delivery_date
 * передаётся как null, если колонка в таблице есть.
 */
export async function saveManualStockChanges(
  input: z.infer<typeof saveSchema>
): Promise<ManualSaveResult> {
  const parsed = saveSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Некорректные данные" }
  }

  const supabase = createAdminClient()
  const { data: current, error: loadErr } = await supabase
    .from("products")
    .select("id,sku,name,stock,color,image_url")
    .in(
      "id",
      parsed.data.items.map((i) => i.id)
    )

  if (loadErr) {
    console.error("[saveManualStockChanges] load", loadErr)
    return {
      ok: false,
      message: loadErr.message || "Не удалось загрузить товары",
    }
  }
  if (!current?.length) {
    return { ok: false, message: "Товары не найдены" }
  }

  type CurrentRow = {
    id: string
    sku: string
    name: string
    stock: number
    color: string | null
    image_url: string | null
  }
  const byId = new Map(current.map((p) => [p.id, p as CurrentRow]))
  const changes: ManualChangeRow[] = []

  for (const item of parsed.data.items) {
    const row = byId.get(item.id)
    if (!row) continue
    if (row.stock === item.stock) continue
    changes.push({
      product_id: row.id,
      sku: row.sku,
      name: row.name,
      was: row.stock,
      became: item.stock,
      color: row.color,
      image_url: row.image_url,
    })
  }

  if (changes.length === 0) {
    return { ok: false, message: "Нет изменений для сохранения" }
  }

  const snapshot: ParsedSnapshot = {
    kind: "manual",
    changes: changes.map((c) => ({
      product_id: c.product_id,
      sku: c.sku,
      name: c.name,
      was: c.was,
      became: c.became,
      color: c.color ?? null,
      image_url: c.image_url ?? null,
    })),
  }

  for (const c of changes) {
    const { error: upErr } = await supabase
      .from("products")
      .update({ stock: c.became })
      .eq("id", c.product_id)

    if (upErr) {
      console.error("[saveManualStockChanges] update", upErr)
      return {
        ok: false,
        message: upErr.message || "Не удалось обновить остаток",
      }
    }
  }

  const rowMinimal = {
    raw_text: "Ручное изменение остатков в таблице",
    parsed_json: snapshot as unknown as Record<string, unknown>,
  }

  let { error: insErr } = await supabase.from("inventory_updates").insert(rowMinimal)

  if (insErr) {
    const { error: insErr2 } = await supabase.from("inventory_updates").insert({
      ...rowMinimal,
      delivery_date: null,
    })
    insErr = insErr2
  }

  if (insErr) {
    console.error("[saveManualStockChanges] insert", insErr)
    return {
      ok: false,
      message:
        insErr.message ||
        "Остатки обновлены, но запись в историю не удалась. Проверьте таблицу inventory_updates.",
    }
  }

  revalidatePath("/")
  revalidatePath("/history")
  return { ok: true }
}
