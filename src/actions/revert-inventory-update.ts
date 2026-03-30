"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { createAdminClient } from "@/lib/supabase/admin"
import type {
  ManualChangeRow,
  ParsedSnapshot,
  SnapshotLine,
} from "@/lib/types"

const schema = z.object({ updateId: z.string().uuid() })

function normalizeSkuKey(sku: string) {
  return sku.trim().toLowerCase()
}

function isLegacyShipmentLine(line: unknown): boolean {
  const o = line as Record<string, unknown>
  return (
    typeof o.display_name === "string" &&
    typeof o.quantity === "number" &&
    typeof o.line_number !== "number"
  )
}

export type RevertInventoryResult =
  | { ok: true }
  | { ok: false; message: string }

export async function revertInventoryUpdate(
  input: z.infer<typeof schema>
): Promise<RevertInventoryResult> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Некорректный идентификатор записи" }
  }

  const supabase = createAdminClient()
  const { data: row, error: fetchErr } = await supabase
    .from("inventory_updates")
    .select("id, parsed_json")
    .eq("id", parsed.data.updateId)
    .maybeSingle()

  if (fetchErr || !row) {
    return { ok: false, message: "Запись не найдена" }
  }

  const snap = row.parsed_json as ParsedSnapshot

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, sku")

  if (prodErr || !products?.length) {
    return { ok: false, message: "Не удалось загрузить каталог товаров" }
  }

  const bySku = new Map(
    products.map((p) => [normalizeSkuKey(String(p.sku)), String(p.id)])
  )

  if (snap.kind === "manual" && snap.changes?.length) {
    for (const c of snap.changes as ManualChangeRow[]) {
      const pid =
        c.product_id ?? (c.sku ? bySku.get(normalizeSkuKey(c.sku)) : undefined)
      if (!pid) {
        return {
          ok: false,
          message:
            "Не удалось сопоставить строку с товаром по SKU. Отмена невозможна.",
        }
      }
      const delta = c.was - c.became
      const { data: cur, error: curErr } = await supabase
        .from("products")
        .select("stock")
        .eq("id", pid)
        .maybeSingle()

      if (curErr || cur == null) {
        return { ok: false, message: "Товар не найден при отмене" }
      }

      const { error: upErr } = await supabase
        .from("products")
        .update({ stock: Number(cur.stock) + delta })
        .eq("id", pid)

      if (upErr) {
        console.error("[revertInventoryUpdate] manual", upErr)
        return { ok: false, message: upErr.message || "Не удалось отменить" }
      }
    }
  } else if (snap.lines?.length) {
    for (const raw of snap.lines) {
      if (isLegacyShipmentLine(raw)) {
        return {
          ok: false,
          message:
            "Запись в старом формате без привязки к каталогу — отмена недоступна.",
        }
      }
    }

    const byProduct = new Map<string, number>()
    for (const line of snap.lines as SnapshotLine[]) {
      if (line.status !== "found") continue
      let pid = line.product_id
      if (!pid && line.sku) {
        pid = bySku.get(normalizeSkuKey(line.sku))
      }
      if (!pid) continue
      byProduct.set(pid, (byProduct.get(pid) ?? 0) + line.total_quantity)
    }

    if (byProduct.size === 0) {
      return {
        ok: false,
        message:
          "Нет строк для отмены: товары не сопоставлены или списание не применялось.",
      }
    }

    for (const [pid, qty] of byProduct) {
      const { data: cur, error: curErr } = await supabase
        .from("products")
        .select("stock")
        .eq("id", pid)
        .maybeSingle()

      if (curErr || cur == null) {
        return { ok: false, message: "Товар не найден при отмене" }
      }

      const { error: upErr } = await supabase
        .from("products")
        .update({ stock: Number(cur.stock) + qty })
        .eq("id", pid)

      if (upErr) {
        console.error("[revertInventoryUpdate] shipment", upErr)
        return { ok: false, message: upErr.message || "Не удалось отменить" }
      }
    }
  } else {
    return { ok: false, message: "В записи нет данных для отмены" }
  }

  const { error: delErr } = await supabase
    .from("inventory_updates")
    .delete()
    .eq("id", parsed.data.updateId)

  if (delErr) {
    console.error("[revertInventoryUpdate] delete", delErr)
    return {
      ok: false,
      message:
        delErr.message ||
        "Остатки восстановлены, но не удалось удалить запись из истории.",
    }
  }

  revalidatePath("/")
  revalidatePath("/history")
  return { ok: true }
}
