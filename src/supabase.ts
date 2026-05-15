import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase unique pour l'application.
 *
 * Variables d'environnement requises (cf. .env.example) :
 *   - VITE_SUPABASE_URL    : URL du projet (https://<ref>.supabase.co)
 *   - VITE_SUPABASE_ANON_KEY : clé anonyme (publique, RLS-safe)
 *
 * Si l'une est absente, on construit quand même un client (pour ne pas
 * crasher au build), mais toute opération auth lèvera une erreur claire
 * — détectable via `isSupabaseConfigured()`.
 */

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = (): boolean =>
  Boolean(url) && Boolean(anonKey)

export const SUPABASE_CONFIG_ERROR =
  "Supabase n'est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local — voir docs/architecture.md §6 (étape 1) et README.md."

const fallbackUrl = url || 'https://placeholder.supabase.co'
const fallbackKey = anonKey || 'placeholder'

export const supabase: SupabaseClient = createClient(fallbackUrl, fallbackKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'plan-financier-supabase-auth',
  },
})

/**
 * Wrapper qui jette `SUPABASE_CONFIG_ERROR` au lieu d'envoyer une requête
 * vers placeholder.supabase.co. À utiliser dans les handlers UI.
 */
export const ensureSupabaseConfigured = (): void => {
  if (!isSupabaseConfigured()) {
    throw new Error(SUPABASE_CONFIG_ERROR)
  }
}
