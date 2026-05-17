import { describe, it, expect } from 'vitest'
import {
  accountFromRow,
  accountToRow,
  ensureUuid,
  newUuid,
  recurringRuleFromRow,
  recurringRuleToRow,
  savingsGoalFromRow,
  savingsGoalToRow,
  transactionFromRow,
  transactionToRow,
  type AccountRow,
  type RecurringRuleRow,
  type SavingsGoalRow,
  type TransactionRow,
} from './supabaseMappers'
import type { Account, RecurringRule, SavingsTarget, Transaction } from '../types'

const USER_ID = '11111111-2222-3333-4444-555555555555'
const ACCOUNT_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('ensureUuid', () => {
  it('passe un uuid valide tel quel', () => {
    expect(ensureUuid(USER_ID)).toBe(USER_ID)
  })

  it('convertit un number en uuid déterministe', () => {
    const id1 = ensureUuid(12345)
    const id2 = ensureUuid(12345)
    expect(id1).toBe(id2)
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('convertit deux numbers différents en uuid différents', () => {
    expect(ensureUuid(1)).not.toBe(ensureUuid(2))
  })

  it("convertit une string non-uuid en uuid déterministe", () => {
    expect(ensureUuid('orphan')).toMatch(/^[0-9a-f]{8}-/i)
  })
})

describe('newUuid', () => {
  it('génère un uuid v4 valide', () => {
    const uuid = newUuid()
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('génère des uuid distincts à chaque appel', () => {
    expect(newUuid()).not.toBe(newUuid())
  })
})

describe('Account mapper', () => {
  const account: Account = {
    id: ACCOUNT_UUID,
    ownerMember: 'principal',
    name: 'Compte courant',
    type: 'checking',
    currency: 'EUR',
    initialBalance: 1234.56,
    displayColor: '#8B6C52',
    displayIcon: 'wallet',
    archivedAt: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }

  it('account → row : owner_user_id provient du caller, ownerMember TS ignoré', () => {
    const row = accountToRow(account, USER_ID)
    expect(row.owner_user_id).toBe(USER_ID)
    expect(row.family_group_id).toBeNull()
    expect(row.initial_balance).toBe(1234.56)
    expect(row.archived_at).toBeNull()
  })

  it('account archivé → row archived_at ISO string', () => {
    const row = accountToRow({ ...account, archivedAt: 1700000000000 }, USER_ID)
    expect(row.archived_at).toBe('2023-11-14T22:13:20.000Z')
  })

  it('row → account : ownerMember = owner_user_id', () => {
    const row: AccountRow = {
      id: ACCOUNT_UUID,
      owner_user_id: USER_ID,
      family_group_id: null,
      name: 'Livret A',
      type: 'savings',
      currency: 'EUR',
      initial_balance: 5000,
      display_color: '#3A7D44',
      display_icon: 'piggy-bank',
      archived_at: null,
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-02-01T00:00:00.000Z',
    }
    const a = accountFromRow(row)
    expect(a.ownerMember).toBe(USER_ID)
    expect(a.type).toBe('savings')
    expect(a.initialBalance).toBe(5000)
    expect(a.createdAt).toBe(new Date('2024-01-01').getTime())
  })

  it('round-trip account preserve les champs principaux', () => {
    const row = accountToRow(account, USER_ID) as AccountRow
    const back = accountFromRow({
      ...row,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    })
    expect(back.name).toBe(account.name)
    expect(back.type).toBe(account.type)
    expect(back.initialBalance).toBe(account.initialBalance)
    expect(back.displayColor).toBe(account.displayColor)
  })
})

describe('Transaction mapper', () => {
  const tx: Transaction = {
    id: 42,
    label: 'Loyer',
    amount: 1200,
    category: 'Maison',
    member: 'principal',
    date: '2026-05-05',
    kind: 'depense',
    envelope: 'Maison',
    accountId: ACCOUNT_UUID,
  }

  it('tx → row : id converti en uuid déterministe, accountId préservé', () => {
    const row = transactionToRow(tx, USER_ID)
    expect(row.id).toMatch(/^[0-9a-f]{8}-/i)
    expect(row.account_id).toBe(ACCOUNT_UUID)
    expect(row.amount).toBe(1200)
    expect(row.occurred_at).toBe('2026-05-05')
    expect(row.kind).toBe('depense')
    expect(row.created_by_user_id).toBe(USER_ID)
    expect(row.transfer_group_id).toBeNull()
  })

  it('tx sans accountId → row.account_id = uuid "orphan" (fallback temporaire)', () => {
    const orphan: Transaction = { ...tx, accountId: undefined }
    const row = transactionToRow(orphan, USER_ID)
    // Le fallback doit être un uuid valide
    expect(row.account_id).toMatch(/^[0-9a-f]{8}-/i)
    // Et déterministe : 2 transactions orphelines → même account_id de fallback
    const row2 = transactionToRow({ ...orphan, id: 99 }, USER_ID)
    expect(row2.account_id).toBe(row.account_id)
  })

  it('row → tx : fallback category="Autre" + envelope="Perso" en 2.A', () => {
    const row: TransactionRow = {
      id: ACCOUNT_UUID,
      account_id: ACCOUNT_UUID,
      category_id: null,
      amount: 50,
      kind: 'revenu',
      occurred_at: '2026-05-10',
      label: 'Salaire',
      notes: null,
      paid_by_user_id: USER_ID,
      created_by_user_id: USER_ID,
      recurring_rule_id: null,
      receipt_storage_path: null,
      ai_categorized: false,
      transfer_group_id: null,
    }
    const t = transactionFromRow(row)
    expect(t.label).toBe('Salaire')
    expect(t.category).toBe('Autre')
    expect(t.envelope).toBe('Perso')
    expect(t.member).toBe(USER_ID)
    expect(t.kind).toBe('revenu')
    expect(typeof t.id).toBe('number') // legacy compatibility 2.A
  })
})

describe('RecurringRule mapper', () => {
  const rule: RecurringRule = {
    id: 'rule-uuid-1',
    member: 'principal',
    category: 'Maison',
    envelope: 'Maison',
    label: 'Loyer mensuel',
    amount: 1200,
    kind: 'depense',
    frequency: 'monthly',
    dayOfPeriod: 5,
    startDate: '2026-01-01',
    endDate: null,
    lastGeneratedOn: null,
    pausedAt: null,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }

  it('rule → row : kind depense → debit', () => {
    const row = recurringRuleToRow(rule, ACCOUNT_UUID)
    expect(row.kind).toBe('debit')
    expect(row.account_id).toBe(ACCOUNT_UUID)
    expect(row.day_of_period).toBe(5)
    expect(row.frequency).toBe('monthly')
    expect(row.paused_at).toBeNull()
  })

  it('rule revenu → row.kind credit', () => {
    const row = recurringRuleToRow({ ...rule, kind: 'revenu' }, ACCOUNT_UUID)
    expect(row.kind).toBe('credit')
  })

  it('rule paused → row.paused_at ISO', () => {
    const row = recurringRuleToRow({ ...rule, pausedAt: 1700000000000 }, ACCOUNT_UUID)
    expect(row.paused_at).toBe('2023-11-14T22:13:20.000Z')
  })

  it('row → rule : debit → depense, credit → revenu', () => {
    const row: RecurringRuleRow = {
      id: 'rule-uuid-2',
      account_id: ACCOUNT_UUID,
      category_id: null,
      label: 'Abonnement Netflix',
      amount: 15.99,
      kind: 'debit',
      frequency: 'monthly',
      day_of_period: 15,
      start_date: '2026-02-01',
      end_date: null,
      last_generated_on: null,
      paused_at: null,
    }
    const r = recurringRuleFromRow(row)
    expect(r.kind).toBe('depense')
    expect(r.amount).toBe(15.99)
    expect(r.frequency).toBe('monthly')
  })
})

describe('SavingsGoal mapper', () => {
  const goal: SavingsTarget = {
    id: 'goal-uuid-1',
    label: 'Vacances 2027',
    targetAmount: 3000,
    targetDate: '2027-08-01',
    destinationAccountId: ACCOUNT_UUID,
    currentSaved: 500,
    displayColor: '#6B5B8A',
    achievedAt: undefined,
    member: 'principal',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  }

  it('goal → row : owner_user_id provient du caller', () => {
    const row = savingsGoalToRow(goal, USER_ID)
    expect(row.owner_user_id).toBe(USER_ID)
    expect(row.family_group_id).toBeNull()
    expect(row.target_amount).toBe(3000)
    expect(row.target_date).toBe('2027-08-01')
    expect(row.destination_account_id).toBe(ACCOUNT_UUID)
    expect(row.achieved_at).toBeNull()
  })

  it('goal sans date cible → row.target_date null', () => {
    const row = savingsGoalToRow({ ...goal, targetDate: undefined }, USER_ID)
    expect(row.target_date).toBeNull()
  })

  it('goal achieved → row.achieved_at ISO', () => {
    const row = savingsGoalToRow({ ...goal, achievedAt: 1700000000000 }, USER_ID)
    expect(row.achieved_at).toBe('2023-11-14T22:13:20.000Z')
  })

  it('row → goal : currentSaved laissé undefined (recalculé depuis compte)', () => {
    const row: SavingsGoalRow = {
      id: 'goal-uuid-2',
      owner_user_id: USER_ID,
      family_group_id: null,
      label: 'Voiture',
      target_amount: 12000,
      target_date: '2028-01-01',
      destination_account_id: ACCOUNT_UUID,
      display_color: '#8B6C52',
      achieved_at: null,
    }
    const g = savingsGoalFromRow(row)
    expect(g.targetAmount).toBe(12000)
    expect(g.destinationAccountId).toBe(ACCOUNT_UUID)
    expect(g.currentSaved).toBeUndefined()
    expect(g.member).toBe(USER_ID)
  })
})
