// Import CSV de relevés bancaires : parsing bas niveau, inférence du mapping de
// colonnes, détection de doublons et construction des lignes de prévisualisation.
// Fonctions pures (aucun état React) extraites de App.tsx.
import { getDateDistanceInDays } from './dates'
import { computeLabelSimilarity, normalizeText } from './text'
import { suggestCategoryFromLabel } from './categories'
import type {
  CsvColumnMapping,
  CsvPreviewRow,
  CsvRawData,
  FamilyMember,
  Transaction,
  TransactionKind,
} from '../types'

export const parseCsvLine = (line: string) => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  result.push(current.trim())
  return result
}

export const defaultCsvMapping: CsvColumnMapping = {
  date: '',
  label: '',
  amount: '',
  type: '',
}

export const normalizeDateValue = (value: string) => {
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/')
    return `${year}-${month}-${day}`
  }

  return ''
}

export const parseAmountValue = (value: string) => {
  const normalized = value.replace(/\s/g, '').replace(',', '.').replace(/€/g, '')
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : NaN
}

export const parseCsvRawData = (content: string): CsvRawData => {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)

  if (lines.length <= 1) {
    return { headers: [], rows: [] }
  }

  return {
    headers: parseCsvLine(lines[0]),
    rows: lines.slice(1).map((line) => parseCsvLine(line)),
  }
}

export const inferBankProfileKey = (fileName: string, headers: string[]) => {
  const normalizedName = normalizeText(fileName.replace(/\.csv$/i, ''))
  if (normalizedName) {
    return normalizedName
  }

  return normalizeText(headers.join('-')) || 'banque-generique'
}

export const inferCsvMapping = (headers: string[]): CsvColumnMapping => {
  const normalizedHeaders = headers.map((header) => normalizeText(header))

  const findOriginalHeader = (candidates: string[]) => {
    const index = normalizedHeaders.findIndex((header) => candidates.includes(header))
    return index >= 0 ? headers[index] : ''
  }

  return {
    date: findOriginalHeader(['date', 'jour', 'operation date', 'date operation']),
    label: findOriginalHeader(['libelle', 'label', 'description', 'operation']),
    amount: findOriginalHeader(['montant', 'amount', 'somme', 'debit', 'credit']),
    type: findOriginalHeader(['type', 'nature', 'sens']),
  }
}

export const buildTransactionSignature = (item: {
  date: string
  label: string
  amount: number
  kind: TransactionKind
  member?: FamilyMember
}) =>
  [item.date, normalizeText(item.label), item.amount.toFixed(2), item.kind, item.member ?? '']
    .join('|')

export const findDuplicateReason = (
  candidate: {
    date: string
    label: string
    amount: number
    kind: TransactionKind
    member: FamilyMember
  },
  existingTransactions: Transaction[],
) => {
  const exactMatch = existingTransactions.find(
    (transaction) => buildTransactionSignature(transaction) === buildTransactionSignature(candidate),
  )

  if (exactMatch) {
    return `Doublon exact avec ${exactMatch.label}`
  }

  const fuzzyMatch = existingTransactions.find((transaction) => {
    if (transaction.member !== candidate.member || transaction.kind !== candidate.kind) {
      return false
    }

    if (Math.abs(transaction.amount - candidate.amount) > 0.01) {
      return false
    }

    if (getDateDistanceInDays(transaction.date, candidate.date) > 3) {
      return false
    }

    return computeLabelSimilarity(transaction.label, candidate.label) >= 0.72
  })

  return fuzzyMatch ? `Doublon probable avec ${fuzzyMatch.label}` : undefined
}

export const parseCsvTransactions = (
  rawData: CsvRawData,
  mapping: CsvColumnMapping,
  existingTransactions: Transaction[],
  member: FamilyMember,
): CsvPreviewRow[] => {
  const dateIndex = rawData.headers.indexOf(mapping.date)
  const labelIndex = rawData.headers.indexOf(mapping.label)
  const amountIndex = rawData.headers.indexOf(mapping.amount)
  const typeIndex = rawData.headers.indexOf(mapping.type)

  if (dateIndex === -1 || labelIndex === -1 || amountIndex === -1) {
    return []
  }

  return rawData.rows.flatMap((columns, rowIndex) => {
    const date = normalizeDateValue(columns[dateIndex] ?? '')
    const label = (columns[labelIndex] ?? '').trim()
    const parsedAmount = parseAmountValue(columns[amountIndex] ?? '')
    const rawType = normalizeText(columns[typeIndex] ?? '')
    const inferredCategory = suggestCategoryFromLabel(label) ?? 'Autre'

    if (!date || !label || Number.isNaN(parsedAmount)) {
      return []
    }

    const kind: TransactionKind =
      rawType.includes('revenu') || rawType.includes('credit') || parsedAmount > 0
        ? 'revenu'
        : 'depense'

    const duplicateReason = findDuplicateReason(
      {
        date,
        label,
        amount: Math.abs(parsedAmount),
        kind,
        member,
      },
      existingTransactions,
    )

    return [
      {
        id: Date.now() + rowIndex,
        date,
        label,
        amount: Math.abs(parsedAmount),
        kind,
        category: inferredCategory,
        duplicate: !!duplicateReason,
        duplicateReason,
      },
    ]
  })
}
