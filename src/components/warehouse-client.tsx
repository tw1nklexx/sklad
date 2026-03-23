"use client"

import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useTransition } from "react"

import { AddStockModal } from "@/components/add-stock-modal"
import { WarehouseTable } from "@/components/warehouse-table"
import { Button } from "@/components/ui/button"
import { saveManualStockChanges } from "@/actions/manual-stock-actions"
import type { ProductRow } from "@/lib/types"

const CALC_VALID = /^[\d\s+\-*/().]+$/

function safeEval(expr: string): number | null {
  const trimmed = expr.trim()
  if (!trimmed || !CALC_VALID.test(trimmed)) return null
  try {
    const fn = new Function(`"use strict"; return (${trimmed})`)
    const result = fn()
    return typeof result === "number" && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

function QuickCalc() {
  const [expr, setExpr] = React.useState("")
  const [result, setResult] = React.useState<string | null>(null)

  const calculate = () => {
    if (!expr.trim()) {
      setResult(null)
      return
    }
    const v = safeEval(expr)
    setResult(v !== null ? String(v) : "Ошибка")
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Калькулятор
      </p>
      <input
        type="text"
        inputMode="numeric"
        className="h-8 w-full rounded-md border border-border/50 bg-background px-2 font-mono text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        placeholder="2*15 + 3*10"
        value={expr}
        onChange={(e) => {
          setExpr(e.target.value)
          const v = safeEval(e.target.value)
          setResult(e.target.value.trim() ? (v !== null ? String(v) : null) : null)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") calculate()
        }}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex h-7 flex-1 items-center justify-center rounded-md border border-border/50 bg-background text-xs font-medium text-foreground transition-colors hover:bg-muted/50 active:bg-muted"
          onClick={calculate}
        >
          =
        </button>
        <button
          type="button"
          className="flex h-7 flex-1 items-center justify-center rounded-md text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground active:bg-muted"
          onClick={() => {
            setExpr("")
            setResult(null)
          }}
        >
          Очистить
        </button>
      </div>
      {result !== null && (
        <div className="border-t border-border/40 pt-2">
          <p className="text-[10px] text-muted-foreground">Результат:</p>
          <p
            className={`font-mono text-lg font-semibold tabular-nums leading-tight ${
              result === "Ошибка"
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {result}
          </p>
        </div>
      )}
    </div>
  )
}

export function WarehouseClient({
  products,
  supabaseReady,
  loadError,
}: {
  products: ProductRow[]
  supabaseReady: boolean
  loadError: string | null
}) {
  const router = useRouter()
  const [editMode, setEditMode] = React.useState(false)
  const [draftStock, setDraftStock] = React.useState<Record<string, number>>({})
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  React.useEffect(() => {
    if (!editMode) return
    setDraftStock((prev) => {
      const next = { ...prev }
      for (const p of products) {
        if (next[p.id] === undefined) next[p.id] = p.stock
      }
      for (const id of Object.keys(next)) {
        if (!products.some((p) => p.id === id)) delete next[id]
      }
      return next
    })
  }, [products, editMode])

  const startEdit = () => {
    setSaveError(null)
    setDraftStock(Object.fromEntries(products.map((p) => [p.id, p.stock])))
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
    setDraftStock({})
    setSaveError(null)
  }

  const onStockChange = React.useCallback((productId: string, value: number) => {
    setDraftStock((prev) => ({ ...prev, [productId]: value }))
  }, [])

  const hasChanges = React.useMemo(
    () =>
      editMode &&
      products.some((p) => (draftStock[p.id] ?? p.stock) !== p.stock),
    [editMode, products, draftStock]
  )

  const onSave = () => {
    setSaveError(null)
    startTransition(async () => {
      const res = await saveManualStockChanges({
        items: products.map((p) => ({
          id: p.id,
          stock: draftStock[p.id] ?? p.stock,
        })),
      })
      if (!res.ok) {
        setSaveError(res.message)
        return
      }
      setEditMode(false)
      setDraftStock({})
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Склад</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Остатки по складу. Списание — по тексту отгрузки или правка вручную.
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

        {saveError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {saveError}
          </div>
        ) : null}

        <WarehouseTable
          products={products}
          editMode={editMode}
          draftStock={draftStock}
          onStockChange={onStockChange}
          emptyMessage={
            supabaseReady
              ? "В каталоге пока нет товаров"
              : "Подключите Supabase и примените миграции"
          }
        />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-20 lg:w-52">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Действия
          </p>
          <AddStockModal
            products={products}
            supabaseReady={supabaseReady}
            disabled={editMode}
          />
          {!editMode ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full justify-center rounded-lg"
              disabled={!supabaseReady || products.length === 0}
              onClick={startEdit}
            >
              Редактировать вручную
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="h-10 w-full justify-center rounded-lg"
                disabled={!hasChanges || isPending}
                onClick={onSave}
              >
                {isPending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Сохранение…
                  </>
                ) : (
                  "Сохранить изменения"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full justify-center rounded-lg text-muted-foreground"
                disabled={isPending}
                onClick={cancelEdit}
              >
                Отмена
              </Button>
            </>
          )}
        </div>
        <QuickCalc />
      </aside>
    </div>
  )
}
