"use client"

import { ChevronDownIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { revertInventoryUpdate } from "@/actions/revert-inventory-update"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProductThumb } from "@/components/product-thumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  InventoryUpdateRow,
  ManualChangeRow,
  ParsedSnapshot,
  ProductRow,
  SnapshotLine,
} from "@/lib/types"
import {
  aggregateManualTotalsBySku,
  aggregateShipmentTotalsByProduct,
  type ImportSkuTotal,
  type ManualSkuTotal,
} from "@/lib/stock-preview"
import { cn } from "@/lib/utils"

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatDeliveryDate(d: string | null) {
  if (!d) return "—"
  try {
    const [y, m, day] = d.split("-").map(Number)
    if (!y || !m || !day) return d
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, day))
  } catch {
    return d
  }
}

function excerpt(text: string, max = 80) {
  const t = text.replace(/\s+/g, " ").trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function coerceSnapshot(raw: unknown): ParsedSnapshot {
  if (!raw || typeof raw !== "object") {
    return { lines: [], changes: [], allow_negative: false }
  }
  const r = raw as ParsedSnapshot
  return {
    kind: r.kind,
    allow_negative: r.allow_negative,
    lines: Array.isArray(r.lines) ? (r.lines as SnapshotLine[]) : [],
    changes: Array.isArray(r.changes) ? (r.changes as ManualChangeRow[]) : [],
  }
}

function isShipmentSnapshot(s: ParsedSnapshot): boolean {
  if (s.kind === "manual") return false
  return Array.isArray(s.lines) && s.lines.length > 0
}

function isLegacyShipmentLine(line: unknown): boolean {
  const o = line as Record<string, unknown>
  return (
    typeof o.display_name === "string" &&
    typeof o.quantity === "number" &&
    typeof o.line_number !== "number"
  )
}

/** Можно ли откатить остатки по этой записи (есть привязка к каталогу). */
function canRevertSnapshot(snap: ParsedSnapshot): boolean {
  if (snap.kind === "manual" && (snap.changes?.length ?? 0) > 0) {
    return true
  }
  const lines = snap.lines
  if (!lines?.length) return false
  for (const raw of lines) {
    if (isLegacyShipmentLine(raw)) return false
  }
  return lines.some((line) => {
    const l = line as SnapshotLine
    return l.status === "found" && Boolean(l.product_id || l.sku?.trim())
  })
}

function formatDelta(delta: number) {
  if (delta > 0) return `+${delta}`
  return String(delta)
}

function ShipmentSkuTotalsBlock({ totals }: { totals: ImportSkuTotal[] }) {
  if (totals.length === 0) return null
  return (
    <div className="mt-4 rounded-lg border border-border/45 bg-muted/25 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Итого по артикулам (отгружено)
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {totals.map((t) => (
          <li
            key={t.product_id}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/30 pb-1.5 last:border-0 last:pb-0"
          >
            <span className="font-mono text-[12px] text-muted-foreground">{t.sku}</span>
            <span className="min-w-0 flex-1 text-foreground">{t.name}</span>
            <span className="tabular-nums font-medium text-foreground">
              {t.total_shipped} шт.
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ManualSkuTotalsBlock({ totals }: { totals: ManualSkuTotal[] }) {
  if (totals.length === 0) return null
  return (
    <div className="mt-4 rounded-lg border border-border/45 bg-muted/25 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Итого по артикулам (изменение остатка)
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {totals.map((t) => (
          <li
            key={`${t.sku}-${t.name}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/30 pb-1.5 last:border-0 last:pb-0"
          >
            <span className="font-mono text-[12px] text-muted-foreground">{t.sku}</span>
            <span className="min-w-0 flex-1 text-foreground">{t.name}</span>
            <span className="tabular-nums font-medium text-foreground">
              {formatDelta(t.delta)} шт.
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function RevertHistoryButton({ updateId }: { updateId: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [msg, setMsg] = React.useState<string | null>(null)

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={pending}
        onClick={() => {
          if (
            !confirm(
              "Отменить это изменение? Остатки по затронутым артикулам вернутся к значениям до этой операции, запись из истории будет удалена."
            )
          ) {
            return
          }
          setMsg(null)
          startTransition(async () => {
            const r = await revertInventoryUpdate({ updateId })
            if (r.ok) {
              router.refresh()
            } else {
              setMsg(r.message)
            }
          })
        }}
      >
        {pending ? "Отмена…" : "Отменить изменение"}
      </Button>
      {msg ? <p className="text-sm text-destructive">{msg}</p> : null}
    </div>
  )
}

function ShipmentDetailTable({ lines, updateId }: { lines: SnapshotLine[]; updateId: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-background">
      <div className="min-w-[720px]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              {["Фото", "Наименование", "SKU", "Коробок", "На коробку", "Итого", "Было → стало", "Статус"].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                )
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, i) => {
              const o = line as Record<string, unknown>
              const legacy =
                typeof o.display_name === "string" &&
                typeof o.quantity === "number" &&
                typeof o.line_number !== "number"
              const key = `${updateId}-s-${i}`

              if (legacy) {
                return (
                  <TableRow key={key} className="border-border/60">
                    <TableCell className="py-2">
                      <ProductThumb src={null} alt={String(o.display_name)} size={36} />
                    </TableCell>
                    <TableCell className="max-w-[200px] whitespace-normal text-sm font-medium">
                      {String(o.display_name)}
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">—</TableCell>
                    <TableCell className="tabular-nums text-sm">—</TableCell>
                    <TableCell className="tabular-nums text-sm">—</TableCell>
                    <TableCell className="tabular-nums text-sm font-medium">{o.quantity as number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell className="text-sm">
                      {o.status === "not_found" ? (
                        <span className="text-destructive">не найден</span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400">найден</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              }

              const transition =
                line.stock_before !== undefined && line.stock_after !== undefined
                  ? `${line.stock_before} → ${line.stock_after}`
                  : "—"

              return (
                <TableRow key={key} className="border-border/60">
                  <TableCell className="py-2">
                    <ProductThumb
                      src={line.status === "found" ? line.image_url : null}
                      alt={line.matched_name ?? line.product_name}
                      size={36}
                    />
                  </TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal text-sm font-medium">
                    {line.matched_name ?? line.product_name}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">
                    {line.status === "found" ? (line.sku ?? "—") : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">{line.box_count}</TableCell>
                  <TableCell className="tabular-nums text-sm">{line.per_box_quantity}</TableCell>
                  <TableCell className="tabular-nums text-sm font-medium">{line.total_quantity}</TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">{transition}</TableCell>
                  <TableCell
                    className={cn(
                      "text-sm font-medium",
                      line.status === "not_found"
                        ? "text-destructive"
                        : "text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {line.status === "found" ? "найден" : "не найден"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function normalizeSkuKey(sku: string) {
  return sku.trim().toLowerCase()
}

function resolveManualRowDisplay(
  c: ManualChangeRow,
  byId: Map<string, ProductRow>,
  bySku: Map<string, ProductRow>
): {
  image: string | null
  color: string | null
  name: string
  sku: string
  was: number
  became: number
} {
  const fromCat =
    (c.product_id ? byId.get(c.product_id) : undefined) ??
    (c.sku ? bySku.get(normalizeSkuKey(c.sku)) : undefined)

  const snapImage =
    c.image_url !== undefined && c.image_url !== null && String(c.image_url).trim() !== ""
      ? String(c.image_url).trim()
      : null
  const snapColor =
    c.color !== undefined && c.color !== null && String(c.color).trim() !== ""
      ? String(c.color).trim()
      : null

  return {
    image: snapImage ?? fromCat?.image_url ?? null,
    color: snapColor ?? fromCat?.color ?? null,
    name: c.name,
    sku: c.sku,
    was: c.was,
    became: c.became,
  }
}

function ManualDetailTable({
  changes,
  updateId,
  products,
}: {
  changes: ManualChangeRow[]
  updateId: string
  products: ProductRow[]
}) {
  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  )
  const bySku = React.useMemo(
    () => new Map(products.map((p) => [normalizeSkuKey(p.sku), p])),
    [products]
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-background">
      <div className="min-w-[640px]">
        <Table>
          <TableHeader>
            <TableRow className="border-border/60 hover:bg-transparent">
              {["Фото", "Наименование", "Цвет", "SKU", "Было → стало"].map((h) => (
                <TableHead
                  key={h}
                  className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((c, i) => {
              const row = resolveManualRowDisplay(c, byId, bySku)
              return (
                <TableRow key={`${updateId}-m-${i}`} className="border-border/60">
                  <TableCell className="py-2">
                    <ProductThumb src={row.image} alt={row.name} size={36} />
                  </TableCell>
                  <TableCell className="max-w-[200px] whitespace-normal text-sm font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.color ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">
                    {row.sku}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {row.was} → {row.became}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export function HistoryList({
  updates,
  products,
}: {
  updates: InventoryUpdateRow[]
  /** Текущий каталог для подстановки фото/цвета в старых записях ручного редактирования */
  products: ProductRow[]
}) {
  const [openId, setOpenId] = React.useState<string | null>(null)

  if (updates.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          Пока нет записей. Списание или ручное сохранение появятся здесь.
        </p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {updates.map((u) => {
        const open = openId === u.id
        const snap = coerceSnapshot(u.parsed_json)
        const isManual = snap.kind === "manual" && (snap.changes?.length ?? 0) > 0
        const shipment = isShipmentSnapshot(snap)

        return (
          <li key={u.id}>
            <Card
              size="sm"
              className={cn(
                "overflow-hidden border-border/60 shadow-sm",
                open && "ring-1 ring-foreground/8"
              )}
            >
              <button
                type="button"
                className="flex w-full flex-col gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => setOpenId(open ? null : u.id)}
                aria-expanded={open}
              >
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1fr_minmax(0,1.2fr)] sm:gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Дата отвоза
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{formatDeliveryDate(u.delivery_date)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Запись создана
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{formatDateTime(u.created_at)}</p>
                  </div>
                  <div className="min-w-0 sm:col-span-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Кратко
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{excerpt(u.raw_text)}</p>
                  </div>
                </div>
                <ChevronDownIcon
                  className={cn(
                    "ml-auto size-4 shrink-0 text-muted-foreground transition-transform sm:ml-2",
                    open && "rotate-180"
                  )}
                />
              </button>

              {open ? (
                <div className="space-y-5 border-t border-border/60 bg-muted/10 px-4 py-5">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Полный текст
                    </p>
                    <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-background p-4 font-mono text-[13px] leading-relaxed">
                      {u.raw_text}
                    </pre>
                  </div>

                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Таблица изменений
                    </p>
                    <div className="mt-2">
                      {isManual && snap.changes ? (
                        <>
                          <ManualDetailTable
                            changes={snap.changes}
                            updateId={u.id}
                            products={products}
                          />
                          <ManualSkuTotalsBlock
                            totals={aggregateManualTotalsBySku(snap.changes)}
                          />
                        </>
                      ) : shipment && snap.lines?.length ? (
                        <>
                          <ShipmentDetailTable lines={snap.lines} updateId={u.id} />
                          <ShipmentSkuTotalsBlock
                            totals={aggregateShipmentTotalsByProduct(snap.lines)}
                          />
                        </>
                      ) : (
                        <p className="rounded-xl border border-dashed border-border/60 bg-background py-10 text-center text-sm text-muted-foreground">
                          Нет структурированных данных
                        </p>
                      )}
                    </div>
                    {canRevertSnapshot(snap) ? (
                      <RevertHistoryButton updateId={u.id} />
                    ) : null}
                    {snap.allow_negative ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        С отрицательным остатком (по тексту отгрузки).
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
