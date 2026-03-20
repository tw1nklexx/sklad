import type { ParsedContribution } from "@/lib/parser"
import { normalizeProductName } from "@/lib/parser"
import type { ProductRow, SnapshotLine } from "@/lib/types"

export type PreviewRow = SnapshotLine & {
  normalized_key: string
  segment_index: number
}

export function indexProductsByNormalizedName(
  products: Pick<ProductRow, "id" | "sku" | "name" | "stock" | "image_url">[]
): Map<string, Pick<ProductRow, "id" | "sku" | "name" | "stock" | "image_url">> {
  const m = new Map<string, Pick<ProductRow, "id" | "sku" | "name" | "stock" | "image_url">>()
  for (const p of products) {
    m.set(normalizeProductName(p.name), p)
  }
  return m
}

export function buildPreviewRows(
  contributions: ParsedContribution[],
  products: Pick<ProductRow, "id" | "sku" | "name" | "stock" | "image_url">[]
): PreviewRow[] {
  const idx = indexProductsByNormalizedName(products)
  const totals = new Map<string, number>()
  for (const c of contributions) {
    const t = totals.get(c.product_name_normalized) ?? 0
    totals.set(c.product_name_normalized, t + c.total_quantity)
  }

  return contributions.map((c) => {
    const hit = idx.get(c.product_name_normalized)
    if (!hit) {
      return {
        normalized_key: c.product_name_normalized,
        line_number: c.line_number,
        segment_index: c.segment_index,
        box_count: c.box_count,
        product_name: c.product_name,
        per_box_quantity: c.per_box_quantity,
        total_quantity: c.total_quantity,
        status: "not_found" as const,
      }
    }
    const totalForProduct = totals.get(c.product_name_normalized) ?? 0
    const stock_after = hit.stock - totalForProduct
    return {
      normalized_key: c.product_name_normalized,
      line_number: c.line_number,
      segment_index: c.segment_index,
      box_count: c.box_count,
      product_name: c.product_name,
      per_box_quantity: c.per_box_quantity,
      total_quantity: c.total_quantity,
      status: "found" as const,
      product_id: hit.id,
      sku: hit.sku,
      matched_name: hit.name,
      image_url: hit.image_url ?? null,
      stock_before: hit.stock,
      stock_after,
    }
  })
}

export function hasAnyNotFound(rows: PreviewRow[]): boolean {
  return rows.some((r) => r.status === "not_found")
}

export function hasAnyNegative(rows: PreviewRow[]): boolean {
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.status !== "found" || !r.product_id) continue
    if (seen.has(r.product_id)) continue
    seen.add(r.product_id)
    if (r.stock_after !== undefined && r.stock_after < 0) return true
  }
  return false
}

export function negativeProductSummaries(rows: PreviewRow[]): {
  product_id: string
  label: string
  stock_before: number
  stock_after: number
}[] {
  const byId = new Map<
    string,
    { label: string; stock_before: number; stock_after: number }
  >()
  for (const r of rows) {
    if (r.status !== "found" || !r.product_id) continue
    if (r.stock_after === undefined || r.stock_after >= 0) continue
    if (!byId.has(r.product_id)) {
      byId.set(r.product_id, {
        label: r.matched_name ?? r.product_name,
        stock_before: r.stock_before ?? 0,
        stock_after: r.stock_after,
      })
    }
  }
  return [...byId.entries()].map(([product_id, v]) => ({
    product_id,
    ...v,
  }))
}

export function buildDeductionsPayload(
  rows: PreviewRow[]
): { product_id: string; quantity: number }[] {
  const byId = new Map<string, number>()
  for (const r of rows) {
    if (r.status !== "found" || !r.product_id) continue
    byId.set(
      r.product_id,
      (byId.get(r.product_id) ?? 0) + r.total_quantity
    )
  }
  return [...byId.entries()].map(([product_id, quantity]) => ({
    product_id,
    quantity,
  }))
}

export function snapshotLinesFromPreview(rows: PreviewRow[]): SnapshotLine[] {
  return rows.map((row): SnapshotLine => {
      const {
        line_number,
        box_count,
        product_name,
        per_box_quantity,
        total_quantity,
        status,
        product_id,
        sku,
        matched_name,
        image_url,
        stock_before,
        stock_after,
      } = row
      return {
        line_number,
        box_count,
        product_name,
        per_box_quantity,
        total_quantity,
        status,
        product_id,
        sku,
        matched_name,
        image_url,
        stock_before,
        stock_after,
      }
  })
}
