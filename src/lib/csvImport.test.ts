import { describe, it, expect } from 'vitest'
import {
  parseCsvLine,
  normalizeDateValue,
  parseAmountValue,
  parseCsvRawData,
  inferCsvMapping,
  inferBankProfileKey,
  parseCsvTransactions,
} from './csvImport'

describe('parseCsvLine', () => {
  it('découpe une ligne simple', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('respecte les guillemets et les virgules internes', () => {
    expect(parseCsvLine('"Café, Paris",12,00')).toEqual(['Café, Paris', '12', '00'])
  })

  it('gère les guillemets échappés ("")', () => {
    expect(parseCsvLine('"Say ""hi""",x')).toEqual(['Say "hi"', 'x'])
  })
})

describe('normalizeDateValue', () => {
  it('conserve le format ISO', () => {
    expect(normalizeDateValue('2026-04-10')).toBe('2026-04-10')
  })

  it('convertit JJ/MM/AAAA en ISO', () => {
    expect(normalizeDateValue('10/04/2026')).toBe('2026-04-10')
  })

  it('renvoie une chaîne vide si non reconnu', () => {
    expect(normalizeDateValue('avril 2026')).toBe('')
  })
})

describe('parseAmountValue', () => {
  it('gère la virgule décimale, les espaces et le symbole €', () => {
    expect(parseAmountValue('1 234,56 €')).toBeCloseTo(1234.56)
  })

  it('renvoie NaN pour une valeur non numérique', () => {
    expect(Number.isNaN(parseAmountValue('abc'))).toBe(true)
  })
})

describe('parseCsvRawData', () => {
  it('sépare en-têtes et lignes, ignore les lignes vides', () => {
    const raw = parseCsvRawData('date,label\n2026-04-10,Courses\n\n2026-04-11,Essence')
    expect(raw.headers).toEqual(['date', 'label'])
    expect(raw.rows).toHaveLength(2)
  })

  it('renvoie des tableaux vides si une seule ligne', () => {
    expect(parseCsvRawData('date,label')).toEqual({ headers: [], rows: [] })
  })
})

describe('inferCsvMapping', () => {
  it('reconnaît les en-têtes usuels (accents/casse ignorés)', () => {
    const mapping = inferCsvMapping(['Date', 'Libellé', 'Montant', 'Type'])
    expect(mapping).toEqual({ date: 'Date', label: 'Libellé', amount: 'Montant', type: 'Type' })
  })
})

describe('inferBankProfileKey', () => {
  it('dérive la clé depuis le nom de fichier (accents/casse normalisés)', () => {
    expect(inferBankProfileKey('Relevé BNP.csv', ['date'])).toBe('releve bnp')
  })

  it('retombe sur les en-têtes puis un défaut', () => {
    expect(inferBankProfileKey('', ['Date', 'Montant'])).toBe('date montant')
    expect(inferBankProfileKey('', [])).toBe('banque-generique')
  })
})

describe('parseCsvTransactions', () => {
  const rawData = parseCsvRawData('date,label,montant,type\n10/04/2026,Salaire,1500,credit\n11/04/2026,Courses,-42,debit')
  const mapping = { date: 'date', label: 'label', amount: 'montant', type: 'type' }

  it('construit des lignes de prévisualisation avec montants absolus et sens', () => {
    const rows = parseCsvTransactions(rawData, mapping, [], 'p1')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ date: '2026-04-10', label: 'Salaire', amount: 1500, kind: 'revenu' })
    expect(rows[1]).toMatchObject({ date: '2026-04-11', label: 'Courses', amount: 42, kind: 'depense' })
  })

  it('ignore les lignes dont la date ou le montant est invalide', () => {
    const bad = parseCsvRawData('date,label,montant,type\nx,Bad,abc,debit')
    expect(parseCsvTransactions(bad, mapping, [], 'p1')).toEqual([])
  })

  it('marque les doublons exacts', () => {
    const existing = [
      { id: 1, date: '2026-04-11', label: 'Courses', amount: 42, kind: 'depense' as const, category: 'Autre' as const, member: 'p1', envelope: 'Perso' as const },
    ]
    const rows = parseCsvTransactions(rawData, mapping, existing, 'p1')
    expect(rows[1].duplicate).toBe(true)
  })
})
