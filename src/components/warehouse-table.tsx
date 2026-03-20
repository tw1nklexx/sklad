"use client"

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProductThumb } from "@/components/product-thumb"
import { StockStatusIndicator } from "@/components/stock-status-indicator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getStockLevel } from "@/lib/stock-status"
import type { ProductRow } from "@/lib/types"

type RowModel = ProductRow & { _displayStock: number }

export function WarehouseTable({
  products,
  editMode,
  draftStock,
  onStockChange,
  emptyMessage = "Нет товаров",
}: {
  products: ProductRow[]
  editMode: boolean
  draftStock: Record<string, number>
  onStockChange: (productId: string, value: number) => void
  emptyMessage?: string
}) {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "name", desc: false },
  ])

  const data = React.useMemo<RowModel[]>(
    () =>
      products.map((p) => ({
        ...p,
        _displayStock: draftStock[p.id] ?? p.stock,
      })),
    [products, draftStock]
  )

  const columns = React.useMemo<ColumnDef<RowModel>[]>(
    () => [
      {
        id: "photo",
        header: "Фото",
        enableSorting: false,
        cell: ({ row }) => (
          <ProductThumb src={row.original.image_url} alt={row.original.name} size={44} />
        ),
      },
      {
        accessorKey: "name",
        header: "Наименование",
        cell: ({ row }) => (
          <span className="max-w-[180px] whitespace-normal text-sm font-medium text-foreground sm:max-w-[220px]">
            {row.original.name}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "sku",
        header: "SKU",
        cell: ({ row }) => (
          <span className="font-mono text-[12px] text-muted-foreground">
            {row.original.sku}
          </span>
        ),
        enableSorting: true,
      },
      {
        accessorKey: "color",
        header: "Цвет",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.color ?? "—"}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: "stock",
        accessorFn: (r) => r._displayStock,
        header: "Остаток",
        cell: ({ row }) => {
          const id = row.original.id
          if (editMode) {
            return (
              <Input
                type="number"
                inputMode="numeric"
                className="h-8 w-[5.5rem] tabular-nums"
                value={draftStock[id] ?? row.original.stock}
                onChange={(e) => {
                  const t = e.target.value
                  if (t === "") {
                    onStockChange(id, 0)
                    return
                  }
                  const n = Number.parseInt(t, 10)
                  if (Number.isFinite(n)) onStockChange(id, n)
                }}
              />
            )
          }
          return (
            <span className="tabular-nums text-sm text-foreground">
              {row.original._displayStock}
            </span>
          )
        },
        enableSorting: true,
      },
      {
        id: "status",
        header: "Статус",
        enableSorting: false,
        cell: ({ row }) => (
          <StockStatusIndicator level={getStockLevel(row.original._displayStock)} />
        ),
      },
    ],
    [editMode, draftStock, onStockChange]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (products.length === 0) {
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/40 px-6 py-16 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm ring-1 ring-foreground/[0.03]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="border-border/60 hover:bg-transparent">
              {hg.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-2 h-7 gap-1 px-2 font-medium text-muted-foreground hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: <ArrowUpIcon className="size-3.5 opacity-60" />,
                        desc: <ArrowDownIcon className="size-3.5 opacity-60" />,
                      }[header.column.getIsSorted() as string] ?? null}
                    </Button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-border/60 transition-colors hover:bg-muted/25"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-2.5 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
