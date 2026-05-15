import { describe, it, expect } from 'vitest'
import {
  computeAccountBalance,
  computeConsolidatedBalance,
  balanceByAccountType,
  activeAccountsFor,
  validateAccount,
} from './accounts'
import type { Account, Transaction } from '../types'

const makeAccount = (overrides: Partial<Account> = {}): Account => ({
  id: 'acc-1',
  ownerMember: 'principal',
  name: 'Compte courant',
  type: 'checking',
  currency: 'EUR',
  initialBalance: 1000,
  displayColor: null,
  displayIcon: null,
  archivedAt: null,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
})

const makeTransaction = (overrides: Partial<Transaction>): Transaction => ({
  id: Math.floor(Math.random() * 1e6),
  label: 'tx',
  amount: 0,
  category: 'Autre',
  member: 'principal',
  date: '2026-05-01',
  kind: 'depense',
  envelope: 'Perso',
  ...overrides,
})

describe('computeAccountBalance', () => {
  it("ignore les transactions sans accountId", () => {
    const account = makeAccount({ initialBalance: 500 })
    const txs = [
      makeTransaction({ amount: 100, kind: 'depense' }), // pas d'accountId
    ]
    expect(computeAccountBalance(account, txs)).toBe(500)
  })

  it('soustrait les dépenses, ajoute les revenus', () => {
    const account = makeAccount({ id: 'a1', initialBalance: 1000 })
    const txs = [
      makeTransaction({ accountId: 'a1', amount: 200, kind: 'depense' }),
      makeTransaction({ accountId: 'a1', amount: 50, kind: 'depense' }),
      makeTransaction({ accountId: 'a1', amount: 1500, kind: 'revenu' }),
    ]
    expect(computeAccountBalance(account, txs)).toBe(1000 - 200 - 50 + 1500)
  })

  it("n'inclut que les transactions du compte demandé", () => {
    const account = makeAccount({ id: 'a1', initialBalance: 0 })
    const txs = [
      makeTransaction({ accountId: 'a1', amount: 100, kind: 'depense' }),
      makeTransaction({ accountId: 'a2', amount: 9999, kind: 'depense' }),
    ]
    expect(computeAccountBalance(account, txs)).toBe(-100)
  })
})

describe('computeConsolidatedBalance', () => {
  it("somme les soldes des comptes actifs du membre", () => {
    const accounts: Account[] = [
      makeAccount({ id: 'a1', initialBalance: 1000 }),
      makeAccount({ id: 'a2', type: 'savings', initialBalance: 5000 }),
      makeAccount({ id: 'a3', type: 'savings', initialBalance: 200, archivedAt: Date.now() }),
    ]
    const txs = [makeTransaction({ accountId: 'a1', amount: 100, kind: 'depense' })]
    expect(computeConsolidatedBalance(accounts, txs, 'principal')).toBe(1000 - 100 + 5000)
  })

  it("ignore les comptes d'autres membres", () => {
    const accounts: Account[] = [
      makeAccount({ id: 'a1', initialBalance: 1000, ownerMember: 'principal' }),
      makeAccount({ id: 'a2', initialBalance: 999, ownerMember: 'enfant' }),
    ]
    expect(computeConsolidatedBalance(accounts, [], 'principal')).toBe(1000)
  })
})

describe('balanceByAccountType', () => {
  it("groupe les soldes par type", () => {
    const accounts: Account[] = [
      makeAccount({ id: 'cc1', type: 'checking', initialBalance: 1000 }),
      makeAccount({ id: 'liv1', type: 'savings', initialBalance: 5000 }),
      makeAccount({ id: 'liv2', type: 'savings', initialBalance: 2000 }),
    ]
    const result = balanceByAccountType(accounts, [], 'principal')
    expect(result.checking).toBe(1000)
    expect(result.savings).toBe(7000)
    expect(result.cash).toBe(0)
  })
})

describe('activeAccountsFor', () => {
  it("filtre les archivés et les autres membres", () => {
    const accounts: Account[] = [
      makeAccount({ id: 'a1', ownerMember: 'principal' }),
      makeAccount({ id: 'a2', ownerMember: 'principal', archivedAt: Date.now() }),
      makeAccount({ id: 'a3', ownerMember: 'autre' }),
    ]
    expect(activeAccountsFor(accounts, 'principal').map((a) => a.id)).toEqual(['a1'])
  })
})

describe('validateAccount', () => {
  it('valide un compte correct', () => {
    expect(validateAccount(makeAccount())).toBeNull()
  })

  it('rejette name vide', () => {
    expect(validateAccount(makeAccount({ name: '   ' }))).toBe('name_required')
  })

  it('rejette initialBalance non fini', () => {
    expect(validateAccount(makeAccount({ initialBalance: NaN }))).toBe(
      'initial_balance_must_be_finite',
    )
    expect(validateAccount(makeAccount({ initialBalance: Infinity }))).toBe(
      'initial_balance_must_be_finite',
    )
  })
})
