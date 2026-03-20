import { cn } from "@/lib/utils"
import type { StockLevel } from "@/lib/stock-status"
import { stockLevelLabel } from "@/lib/stock-status"

const dot: Record<StockLevel, string> = {
  ok: "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]",
  low: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.25)]",
  out: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.2)]",
}

export function StockStatusIndicator({
  level,
  className,
}: {
  level: StockLevel
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-sm text-foreground", className)}
    >
      <span
        className={cn("size-2 shrink-0 rounded-full", dot[level])}
        aria-hidden
      />
      {stockLevelLabel(level)}
    </span>
  )
}
