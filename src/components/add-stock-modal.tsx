"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { applyStockUpdate } from "@/actions/stock-actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ProductThumb } from "@/components/product-thumb"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { parseShipmentStrict } from "@/lib/parser"
import {
  aggregateImportTotalsBySku,
  buildPreviewRows,
  hasAnyNegative,
  hasAnyNotFound,
  negativeProductSummaries,
  stockImportNotFoundMessages,
  type PreviewRow,
} from "@/lib/stock-preview"
import type { ProductRow } from "@/lib/types"
import { cn } from "@/lib/utils"

function defaultDeliveryDate(): string {
  const d = new Date()
  const z = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

const formSchema = z.object({
  deliveryDate: z
    .string()
    .min(1, "Укажите дату отвоза")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата"),
  rawText: z.string(),
  allowNegative: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

const placeholder = `1 коробка - веник черный 20, веник синий 12
2 коробки - совок большой 15
1 коробка - плейсматы золотистые лучи 25`

export function AddStockModal({
  products,
  supabaseReady,
  disabled,
}: {
  products: ProductRow[]
  supabaseReady: boolean
  disabled?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewRow[] | null>(null)
  const [processError, setProcessError] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deliveryDate: defaultDeliveryDate(),
      rawText: "",
      allowNegative: false,
    },
  })

  const rawText = form.watch("rawText")
  const allowNegative = form.watch("allowNegative")
  const deliveryDate = form.watch("deliveryDate")

  React.useEffect(() => {
    if (!open) {
      form.reset({
        deliveryDate: defaultDeliveryDate(),
        rawText: "",
        allowNegative: false,
      })
      setPreview(null)
      setProcessError(null)
      setActionError(null)
      setIsProcessing(false)
    }
  }, [open, form])

  const onProcess = () => {
    setActionError(null)
    setProcessError(null)
    setIsProcessing(true)
    try {
      const text = rawText.trim()
      if (!text) {
        setPreview(null)
        setProcessError("Введите текст отгрузки")
        return
      }
      const contributions = parseShipmentStrict(text)
      if (contributions.length === 0) {
        setPreview([])
        setProcessError("Нет строк в нужном формате.")
        return
      }
      const rows = buildPreviewRows(contributions, products)
      setPreview(rows)
      if (hasAnyNotFound(rows)) {
        setProcessError(stockImportNotFoundMessages(rows).join("\n"))
      } else {
        setProcessError(null)
      }
    } catch (e) {
      setPreview(null)
      setProcessError(e instanceof Error ? e.message : "Ошибка разбора")
    } finally {
      setIsProcessing(false)
    }
  }

  const notFound = preview ? hasAnyNotFound(preview) : false
  const negative = preview ? hasAnyNegative(preview) : false
  const confirmDisabled =
    !preview ||
    preview.length === 0 ||
    notFound ||
    (negative && !allowNegative) ||
    isPending ||
    !supabaseReady ||
    !deliveryDate?.trim()

  const onConfirm = form.handleSubmit((values) => {
    setActionError(null)
    startTransition(async () => {
      const res = await applyStockUpdate({
        deliveryDate: values.deliveryDate.trim(),
        rawText: values.rawText.trim(),
        allowNegative: values.allowNegative,
      })
      if (!res.ok) {
        setActionError(res.message)
        return
      }
      setOpen(false)
      router.refresh()
    })
  })

  const negativeItems = preview ? negativeProductSummaries(preview) : []

  const importSkuTotals = React.useMemo(
    () => (preview && preview.length > 0 ? aggregateImportTotalsBySku(preview) : []),
    [preview]
  )

  return (
    <>
      <Button
        type="button"
        className="h-10 w-full justify-center rounded-lg font-medium"
        disabled={!supabaseReady || disabled}
        title={
          !supabaseReady
            ? "Сначала настройте переменные окружения Supabase"
            : disabled
              ? "Сначала завершите или отмените ручное редактирование"
              : undefined
        }
        onClick={() => setOpen(true)}
      >
        Добавить остатки
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,900px)] w-[min(100%-1.5rem,1200px)] max-w-none flex-col gap-0 overflow-y-auto overflow-x-hidden p-0 shadow-xl ring-1 ring-black/[0.06] sm:max-w-none dark:ring-white/10"
        >
          <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Добавить остатки
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              Укажите дату отвоза и вставьте текст в стандартном формате. После обработки проверьте
              таблицу и подтвердите списание.
            </DialogDescription>
          </DialogHeader>

          <div className="flex w-full flex-col lg:flex-row">
            {/* Левая колонка */}
            <div className="flex w-full min-w-0 flex-col border-b border-border/40 lg:flex-1 lg:border-b-0 lg:border-r">
              <div className="px-6 pt-6">
                <div className="flex flex-col gap-4 pb-4">
                  <div className="shrink-0 space-y-2">
                    <Label htmlFor="delivery-date" className="text-muted-foreground">
                      Дата отвоза <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="delivery-date"
                      type="date"
                      className="h-10 max-w-[11rem] rounded-lg border-border/50 bg-background shadow-none transition-colors focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25"
                      disabled={isPending}
                      {...form.register("deliveryDate")}
                    />
                  </div>

                  <div
                    className="shrink-0 rounded-md border border-border/30 bg-muted/15 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground/80"
                    aria-label="Краткая справка по формату"
                  >
                    <p>
                      <span className="font-medium text-muted-foreground">Формат:</span>{" "}
                      <span className="font-mono text-[9.5px] text-muted-foreground/75">
                        N коробок - товар количество, товар количество
                      </span>
                    </p>
                    <p className="mt-1.5 font-medium text-muted-foreground">Правила:</p>
                    <ul className="mt-0.5 space-y-0.5 pl-0.5 text-[10px] text-muted-foreground/75">
                      <li>• каждая строка начинается с количества коробок</li>
                      <li>• товары через запятую</li>
                      <li>• количество в конце</li>
                      <li>• название как в таблице</li>
                    </ul>
                    <p className="mt-1.5 text-[9.5px] leading-snug text-muted-foreground/70">
                      Подсказка: текст в скобках в конце строки можно указывать для склада — он не
                      влияет на подсчёт.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="shipment-text" className="shrink-0 text-muted-foreground">
                      Текст отгрузки
                    </Label>
                    <Textarea
                      id="shipment-text"
                      placeholder={placeholder}
                      rows={10}
                      className="h-[220px] min-h-[200px] max-h-[280px] w-full resize-y overflow-y-auto rounded-lg border-border/50 bg-background px-3 py-2.5 font-mono text-[13px] leading-relaxed shadow-none transition-colors focus-visible:border-ring/60 focus-visible:ring-2 focus-visible:ring-ring/25"
                      disabled={isPending}
                      {...form.register("rawText")}
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 space-y-3 border-t border-border/40 bg-background px-6 py-3 pb-6 dark:bg-background">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 w-full rounded-lg font-medium shadow-none"
                  onClick={onProcess}
                  disabled={isPending || isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      Обработка…
                    </>
                  ) : (
                    "Обработать"
                  )}
                </Button>
                {processError ? (
                  <div
                    className="max-h-[120px] overflow-y-auto rounded-md border border-destructive/15 bg-destructive/[0.05] px-3 py-2"
                    role="alert"
                  >
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-destructive">
                      {processError}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Правая колонка: предпросмотр */}
            <div className="flex w-full min-w-0 flex-col lg:flex-1">
              <p className="shrink-0 px-6 pt-6 text-sm font-medium tracking-tight text-foreground">
                Предпросмотр
              </p>
              <div className="px-6 pb-6">
                {!preview ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                    Нажмите «Обработать»
                  </div>
                ) : preview.length === 0 ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
                    Пустой результат
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border/40 bg-muted/15">
                    <div className="min-w-[880px]">
                      <Table>
                      <TableHeader>
                        <TableRow className="border-border/45 hover:bg-transparent">
                          {[
                            "Фото",
                            "Наименование",
                            "SKU",
                            "Коробок",
                            "На коробку",
                            "Итого",
                            "Было",
                            "Станет",
                            "Статус",
                          ].map((h) => (
                            <TableHead
                              key={h}
                              className="h-10 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                            >
                              {h}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row) => (
                          <TableRow
                            key={`L${row.line_number}-S${row.segment_index}-${row.normalized_key}`}
                            className={cn(
                              "border-border/45",
                              row.status === "not_found" &&
                                "bg-destructive/[0.06] hover:bg-destructive/10"
                            )}
                          >
                            <TableCell className="py-2.5">
                              <ProductThumb
                                src={row.status === "found" ? row.image_url : null}
                                alt={row.matched_name ?? row.product_name}
                                size={36}
                              />
                            </TableCell>
                            <TableCell className="max-w-[min(140px,28vw)] whitespace-normal text-sm font-medium">
                              {row.status === "found"
                                ? (row.matched_name ?? row.product_name)
                                : row.product_name}
                            </TableCell>
                            <TableCell className="font-mono text-[12px] text-muted-foreground">
                              {row.status === "found" ? row.sku : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">{row.box_count}</TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {row.per_box_quantity}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm font-medium">
                              {row.total_quantity}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm text-muted-foreground">
                              {row.status === "found" ? row.stock_before : "—"}
                            </TableCell>
                            <TableCell className="tabular-nums text-sm">
                              {row.status === "found" ? (
                                <span
                                  className={cn(
                                    row.stock_after !== undefined &&
                                      row.stock_after < 0 &&
                                      "font-medium text-amber-800 dark:text-amber-200"
                                  )}
                                >
                                  {row.stock_after}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-sm font-medium",
                                row.status === "not_found"
                                  ? "text-destructive"
                                  : "text-emerald-700 dark:text-emerald-400"
                              )}
                            >
                              {row.status === "found" ? "найден" : "не найден"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {importSkuTotals.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-border/45 bg-muted/25 px-3 py-2.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Итого по артикулам (отгружено)
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {importSkuTotals.map((t) => (
                        <li
                          key={t.product_id}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/30 pb-1.5 last:border-0 last:pb-0"
                        >
                          <span className="font-mono text-[12px] text-muted-foreground">
                            {t.sku}
                          </span>
                          <span className="min-w-0 flex-1 text-foreground">
                            {t.name}
                          </span>
                          <span className="tabular-nums font-medium text-foreground">
                            {t.total_shipped} шт.
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {negative ? (
                  <div
                    role="status"
                    className="mt-3 shrink-0 rounded-lg border border-amber-200/80 bg-amber-50/80 px-3.5 py-2.5 text-sm text-amber-950 dark:border-amber-900/35 dark:bg-amber-950/20 dark:text-amber-50"
                  >
                    <p className="font-medium">Внимание: отрицательный остаток</p>
                    <ul className="mt-1.5 space-y-0.5 text-xs leading-relaxed opacity-95">
                      {negativeItems.map((r) => (
                        <li key={r.product_id}>
                          {r.label}: после списания будет {r.stock_after} (сейчас{" "}
                          {r.stock_before})
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {notFound ? (
                  <p
                    className="mt-3 shrink-0 text-sm leading-relaxed text-destructive"
                    role="alert"
                  >
                    Есть неизвестные товары — подтверждение недоступно.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-4 border-t border-border/40 bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-background">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="allow-negative-modal"
                checked={allowNegative}
                onCheckedChange={(c) =>
                  form.setValue("allowNegative", c === true, { shouldDirty: true })
                }
                disabled={isPending}
                className="mt-0.5"
              />
              <Label
                htmlFor="allow-negative-modal"
                className="cursor-pointer font-normal leading-snug text-muted-foreground"
              >
                Разрешить отрицательный остаток
              </Label>
            </div>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Отмена
              </Button>
              <Button
                type="button"
                className="rounded-lg"
                onClick={onConfirm}
                disabled={confirmDisabled}
              >
                {isPending ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Сохранение…
                  </>
                ) : (
                  "Подтвердить"
                )}
              </Button>
            </div>
          </DialogFooter>
          {actionError ? (
            <p
              className="shrink-0 whitespace-pre-wrap border-t border-border/40 bg-destructive/5 px-6 py-3 text-sm leading-relaxed text-destructive"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
