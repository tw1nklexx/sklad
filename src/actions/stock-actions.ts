"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { MAX_INPUT_LENGTH, parseShipmentStrict } from "@/lib/parser"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildDeductionsPayload,
  buildPreviewRows,
  hasAnyNegative,
  hasAnyNotFound,
  snapshotLinesFromPreview,
} from "@/lib/stock-preview"
import type { ParsedSnapshot, ProductRow } from "@/lib/types"

const applySchema = z.object({
  deliveryDate: z
    .string()
    .min(1, "Укажите дату отвоза")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата"),
  rawText: z
    .string()
    .min(1, "Введите текст отгрузки")
    .max(MAX_INPUT_LENGTH, "Текст слишком длинный"),
  allowNegative: z.boolean(),
})

function mapRpcError(message: string): string {
  if (message.includes("negative stock")) {
    return "Операция отклонена: отрицательный остаток. Отметьте разрешение или скорректируйте количества."
  }
  if (message.includes("product not found")) {
    return "Товар не найден при записи. Обновите страницу и попробуйте снова."
  }
  if (message.includes("delivery date")) {
    return "Укажите дату отвоза."
  }
  return "Не удалось применить списание. Попробуйте ещё раз."
}

async function fetchProductsFresh(): Promise<
  Pick<ProductRow, "id" | "sku" | "name" | "stock" | "image_url">[]
> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("products")
    .select("id,sku,name,stock,image_url")
    .order("name", { ascending: true })
  if (error) throw new Error("Не удалось загрузить товары")
  return (data ?? []) as Pick<ProductRow, "id" | "sku" | "name" | "stock" | "image_url">[]
}

export type ApplyStockResult =
  | { ok: true }
  | { ok: false; message: string }

export async function applyStockUpdate(
  input: z.infer<typeof applySchema>
): Promise<ApplyStockResult> {
  const parsed = applySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Некорректные данные" }
  }

  const { deliveryDate, rawText, allowNegative } = parsed.data

  let contributions
  try {
    contributions = parseShipmentStrict(rawText)
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Ошибка разбора текста",
    }
  }

  if (contributions.length === 0) {
    return {
      ok: false,
      message: "Нет ни одной строки в формате «N коробка - товар количество»",
    }
  }

  const products = await fetchProductsFresh()
  const preview = buildPreviewRows(contributions, products)

  if (hasAnyNotFound(preview)) {
    return { ok: false, message: "Есть неизвестные товары. Исправьте текст или каталог." }
  }

  if (hasAnyNegative(preview) && !allowNegative) {
    return {
      ok: false,
      message:
        "После списания остаток станет отрицательным. Включите разрешение или измените текст.",
    }
  }

  const snapshot: ParsedSnapshot = {
    kind: "shipment",
    lines: snapshotLinesFromPreview(preview),
    allow_negative: allowNegative,
  }

  const deductions = buildDeductionsPayload(preview)
  const supabase = createAdminClient()

  const { error } = await supabase.rpc("apply_stock_update", {
    p_raw_text: rawText,
    p_parsed_snapshot: snapshot,
    p_deductions: deductions,
    p_allow_negative: allowNegative,
    p_delivery_date: deliveryDate,
  })

  if (error) {
    console.error(error)
    return { ok: false, message: mapRpcError(error.message) }
  }

  revalidatePath("/")
  revalidatePath("/history")
  return { ok: true }
}
