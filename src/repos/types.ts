/**
 * Interfaces génériques de repository (étape 2 archi).
 *
 * Permettent d'avoir deux implémentations interchangeables pour chaque entité :
 * - LocalRepo (localStorage, V1 — déjà en place dans accountsRepo /
 *   recurringRulesRepo)
 * - SupabaseRepo (Postgres + RLS, V2.A — cette session, dispo mais pas
 *   wiré dans App.tsx)
 *
 * Le wire (Phase 2.B + 2.C) consistera à introduire un sync layer qui
 * écrit dans les DEUX (optimistic UI : local d'abord, server en arrière-plan).
 */

export type SyncResult = {
  /** True = persistance distante OK, false = échec (à retry). */
  ok: boolean
  /** Code d'erreur si !ok (auth, network, conflict, validation). */
  error?: 'unauthenticated' | 'network' | 'conflict' | 'validation' | 'unknown'
  /** Message brut côté serveur (debug). */
  message?: string
}

/**
 * Interface CRUD générique pour une entité synchronisable.
 *
 * Conventions :
 * - list() : récupère TOUTES les entités du user authentifié (RLS filtre).
 *   Pour pagination, voir listPaginated en V2.C si besoin (~50k+ rows).
 * - upsert() : insert OR update sur la PK. Idempotent.
 * - upsertMany() : bulk pour le bootstrap initial (1 round-trip réseau).
 * - delete() : hard delete. Pour soft delete, passer par upsert avec
 *   deleted_at renseigné.
 */
export interface SyncRepo<T> {
  list(): Promise<{ data: T[]; result: SyncResult }>
  upsert(entity: T): Promise<SyncResult>
  upsertMany(entities: T[]): Promise<SyncResult>
  delete(id: string): Promise<SyncResult>
}
