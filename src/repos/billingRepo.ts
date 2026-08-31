import { supabase } from '../supabase'

/**
 * Abonnement Stripe : lecture du plan (table `subscriptions`, alimentée par le
 * webhook Stripe côté serveur) et ouverture des parcours de paiement.
 */

export type PlanId = 'free' | 'premium' | 'family'
export type BillingInterval = 'monthly' | 'yearly'

export type SubscriptionInfo = {
  plan: PlanId
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

const FREE_SUBSCRIPTION: SubscriptionInfo = {
  plan: 'free',
  status: 'none',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
}

/** Statuts Stripe considérés comme donnant accès au plan payé. */
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

export const fetchSubscription = async (): Promise<SubscriptionInfo> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end')
    .maybeSingle()
  if (error || !data) return FREE_SUBSCRIPTION
  const active = ACTIVE_STATUSES.has(data.status)
  return {
    plan: active ? ((data.plan as PlanId) ?? 'free') : 'free',
    status: data.status ?? 'none',
    currentPeriodEnd: data.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
  }
}

type FunctionErrorPayload = { error?: string | { message?: string } }

const readFunctionError = async (error: unknown): Promise<string | null> => {
  const context = (error as { context?: Response }).context
  if (!context || typeof context.json !== 'function') return null
  const payload = (await context.json().catch(() => null)) as FunctionErrorPayload | null
  if (!payload) return null
  if (typeof payload.error === 'string') return payload.error
  return payload.error?.message ?? null
}

const NOT_CONFIGURED_MESSAGE =
  'Les paiements ne sont pas encore ouverts — les abonnements arrivent très bientôt !'

/** Crée une session Stripe Checkout et retourne son URL. */
export const startCheckout = async (
  plan: Exclude<PlanId, 'free'>,
  interval: BillingInterval,
): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { plan, interval },
  })
  if (error) {
    const code = await readFunctionError(error)
    if (code === 'billing_not_configured') throw new Error(NOT_CONFIGURED_MESSAGE)
    throw new Error("Impossible d'ouvrir le paiement. Réessayez dans un instant.")
  }
  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error("Impossible d'ouvrir le paiement. Réessayez dans un instant.")
  return url
}

/** Ouvre le portail client Stripe (factures, changement, résiliation). */
export const openBillingPortal = async (): Promise<string> => {
  const { data, error } = await supabase.functions.invoke('stripe-portal', { body: {} })
  if (error) {
    const code = await readFunctionError(error)
    if (code === 'billing_not_configured') throw new Error(NOT_CONFIGURED_MESSAGE)
    if (code === 'no_customer') throw new Error("Aucun abonnement trouvé pour ce compte.")
    throw new Error("Impossible d'ouvrir l'espace de facturation. Réessayez dans un instant.")
  }
  const url = (data as { url?: string } | null)?.url
  if (!url) throw new Error("Impossible d'ouvrir l'espace de facturation. Réessayez dans un instant.")
  return url
}
