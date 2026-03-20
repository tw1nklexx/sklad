import { LOW_STOCK_THRESHOLD } from "@/lib/constants"

export type StockLevel = "ok" | "low" | "out"

export function getStockLevel(stock: number): StockLevel {
  if (stock <= 0) return "out"
  if (stock <= LOW_STOCK_THRESHOLD) return "low"
  return "ok"
}

export function stockLevelLabel(level: StockLevel): string {
  switch (level) {
    case "out":
      return "Нет"
    case "low":
      return "Мало"
    default:
      return "Достаточно"
  }
}
