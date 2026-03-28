export const MAX_INPUT_LENGTH = 10_000

/**
 * Ровно допустимые для импорта остатков названия (как вводит сотрудник).
 * Техническая строка «веник_» сюда не входит и в разборе не участвует.
 */
export const ALLOWED_IMPORT_PRODUCT_NAMES = [
  "веник черный",
  "веник синий",
  "совок большой",
  "совок маленький",
  "ершик бежевый",
  "ершик серый",
  "плейсматы серебряный круг",
  "плейсматы серебряная графика",
  "плейсматы золотая графика",
  "плейсматы розовое золото",
  "плейсматы серебристые лучи",
  "плейсматы золотистые лучи",
] as const

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

export function normalizeProductName(name: string): string {
  return collapseSpaces(name.toLowerCase())
}

/** Нормализованное имя технической строки БД — не сопоставляется с текстом импорта. */
export const IMPORT_EXCLUDED_PRODUCT_NAME_NORMALIZED =
  normalizeProductName("веник_")

const ALLOWED_IMPORT_PRODUCT_NAMES_NORMALIZED = new Set(
  ALLOWED_IMPORT_PRODUCT_NAMES.map((n) => normalizeProductName(n))
)

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

/** Только ASCII «-» между блоком коробок и списком товаров. */
const LINE_RE =
  /^\s*(\d+)\s+(?:коробка|коробки|коробок)\s*-\s*(.+)\s*$/i

/**
 * Убирает необязательную пометку кластера в конце строки: «… (текст)».
 * Скобки сбалансированы с конца строки; не влияет на расчёт остатков.
 */
function stripTrailingClusterNote(line: string): string {
  const t = line.trimEnd()
  if (!t.endsWith(")")) return line.trim()

  let depth = 0
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i]
    if (c === ")") depth++
    else if (c === "(") {
      depth--
      if (depth === 0) {
        return t.slice(0, i).trimEnd()
      }
    }
  }

  return line.trim()
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
    throw new Error(`Строка ${lineNumber}: после тире нет позиций`)
  }
  const m = seg.match(/^(.+?)\s+(\d+)\s*$/)
  if (!m) {
    throw new Error(`Строка ${lineNumber}: не указано количество товара`)
  }
  const rawName = m[1].trim()
  const perBox = Number.parseInt(m[2], 10)
  if (!Number.isFinite(perBox) || perBox <= 0) {
    throw new Error(`Строка ${lineNumber}: не указано количество товара`)
  }
  const product_name = collapseSpaces(rawName)
  const product_name_normalized = normalizeProductName(product_name)
  if (!product_name_normalized) {
    throw new Error(`Строка ${lineNumber}: неверное название товара`)
  }
  if (!ALLOWED_IMPORT_PRODUCT_NAMES_NORMALIZED.has(product_name_normalized)) {
    throw new Error(`Строка ${lineNumber}: неверное название товара`)
  }
  return {
    product_name,
    product_name_normalized,
    per_box_quantity: perBox,
  }
}

/**
 * Строгий разбор: только формат «N коробка(и/ок) - товар количество [, …]».
 * В конце строки допускается « (…)» — пометка кластера, отбрасывается до разбора.
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
    const line = stripTrailingClusterNote(rawLines[i].trim())
    if (!line) continue

    const lm = line.match(LINE_RE)
    if (!lm) {
      throw new Error(`Строка ${lineNumber}: неверный формат строки`)
    }

    const boxCount = Number.parseInt(lm[1], 10)
    if (!Number.isFinite(boxCount) || boxCount <= 0) {
      throw new Error(`Строка ${lineNumber}: неверный формат строки`)
    }

    const right = lm[2].trim()
    if (!right) {
      throw new Error(`Строка ${lineNumber}: после тире нет позиций`)
    }

    const segmentParts = right.split(",").map((s) => s.trim())
    for (const part of segmentParts) {
      if (part === "") {
        throw new Error(`Строка ${lineNumber}: после тире нет позиций`)
      }
    }
    const segments = segmentParts.filter(Boolean)
    if (segments.length === 0) {
      throw new Error(`Строка ${lineNumber}: после тире нет позиций`)
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
