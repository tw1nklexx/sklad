export const MAX_INPUT_LENGTH = 10_000

/** Одна позиция после запятой в строке «N коробок - …» */
export type ParsedContribution = {
  /** Номер строки во входном тексте (с учётом всех строк, 1-based) */
  line_number: number
  /** Порядковый номер фрагмента после запятой в этой строке (1-based) */
  segment_index: number
  box_count: number
  /** Имя товара из текста (как введено, с нормализацией пробелов) */
  product_name: string
  product_name_normalized: string
  /** Количество на одну коробку */
  per_box_quantity: number
  /** Итого к списанию: коробки × на коробку */
  total_quantity: number
}

const LINE_RE =
  /^\s*(\d+)\s+(?:коробка|коробки|коробок)\s*[-–—]\s*(.+?)\s*$/i

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

export function normalizeProductName(name: string): string {
  return collapseSpaces(name.toLowerCase())
}

function parseProductSegment(
  segment: string,
  lineNumber: number
): {
  product_name: string
  product_name_normalized: string
  per_box_quantity: number
} {
  const seg = segment.trim()
  if (!seg) {
    throw new Error(
      `Строка ${lineNumber}: пустой фрагмент после запятой`
    )
  }
  const m = seg.match(/^(.+?)\s+(\d+)\s*$/)
  if (!m) {
    throw new Error(
      `Строка ${lineNumber}: «${seg}» — укажите наименование и целое количество в конце (например: веник черный 20)`
    )
  }
  const rawName = m[1].trim()
  const perBox = Number.parseInt(m[2], 10)
  if (!Number.isFinite(perBox) || perBox <= 0) {
    throw new Error(
      `Строка ${lineNumber}: количество на коробку должно быть целым числом больше нуля`
    )
  }
  const product_name = collapseSpaces(rawName)
  const product_name_normalized = normalizeProductName(product_name)
  if (!product_name_normalized) {
    throw new Error(`Строка ${lineNumber}: не удалось определить наименование`)
  }
  return {
    product_name,
    product_name_normalized,
    per_box_quantity: perBox,
  }
}

/**
 * Строгий разбор: только формат «N коробка(и/ок) - товар количество [, …]».
 * Пустые строки пропускаются. Итого по позиции = число коробок × количество на коробку.
 */
export function parseShipmentStrict(input: string): ParsedContribution[] {
  const trimmed = input.trim()
  if (!trimmed) return []
  if (trimmed.length > MAX_INPUT_LENGTH) {
    throw new Error("Текст слишком длинный")
  }

  const rawLines = trimmed.split(/\r?\n/)
  const out: ParsedContribution[] = []

  for (let i = 0; i < rawLines.length; i++) {
    const lineNumber = i + 1
    const line = rawLines[i].trim()
    if (!line) continue

    const lm = line.match(LINE_RE)
    if (!lm) {
      throw new Error(
        `Строка ${lineNumber}: ожидается формат «1 коробка - товар 20» или «2 коробки - товар 4, другой 5»`
      )
    }

    const boxCount = Number.parseInt(lm[1], 10)
    if (!Number.isFinite(boxCount) || boxCount <= 0) {
      throw new Error(
        `Строка ${lineNumber}: число коробок должно быть целым больше нуля`
      )
    }

    const right = lm[2].trim()
    if (!right) {
      throw new Error(`Строка ${lineNumber}: после тире нет списка товаров`)
    }

    const segments = right.split(",").map((s) => s.trim()).filter(Boolean)
    if (segments.length === 0) {
      throw new Error(`Строка ${lineNumber}: после тире нет ни одной позиции`)
    }

    let segIdx = 0
    for (const segment of segments) {
      segIdx += 1
      const parsed = parseProductSegment(segment, lineNumber)
      out.push({
        line_number: lineNumber,
        segment_index: segIdx,
        box_count: boxCount,
        product_name: parsed.product_name,
        product_name_normalized: parsed.product_name_normalized,
        per_box_quantity: parsed.per_box_quantity,
        total_quantity: boxCount * parsed.per_box_quantity,
      })
    }
  }

  return out
}
