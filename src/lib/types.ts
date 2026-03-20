export type ProductRow = {
  id: string
  sku: string
  name: string
  image_url: string | null
  color: string | null
  stock: number
  created_at: string
}

export type ManualChangeRow = {
  /** В старых записях может отсутствовать — тогда подстановка только по SKU */
  product_id?: string
  sku: string
  name: string
  was: number
  became: number
  /** Снимок на момент сохранения; в старых записях может отсутствовать */
  color?: string | null
  image_url?: string | null
}

export type InventoryUpdateRow = {
  id: string
  raw_text: string
  parsed_json: ParsedSnapshot
  delivery_date: string | null
  created_at: string
}

export type PreviewLineStatus = "found" | "not_found"

/** Строка сохранённого разбора (отгрузка по тексту). */
export type SnapshotLine = {
  line_number: number
  box_count: number
  product_name: string
  per_box_quantity: number
  total_quantity: number
  status: PreviewLineStatus
  product_id?: string
  sku?: string
  matched_name?: string
  image_url?: string | null
  stock_before?: number
  stock_after?: number
}

export type ParsedSnapshot = {
  /** Без поля — старые записи (считаем отгрузкой). */
  kind?: "shipment" | "manual"
  lines?: SnapshotLine[]
  /** Для kind === "manual": строки с было / стало. */
  changes?: ManualChangeRow[]
  allow_negative?: boolean
}
