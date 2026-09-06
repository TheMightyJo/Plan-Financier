# Semaine 10 — Synchronisation complète + suppressions propagées

Avant : seuls les comptes et les opérations étaient dans le cloud. Poches,
profils, objectifs, règles récurrentes, notes, plafonds et préférences
restaient dans le navigateur ; une opération supprimée sur un appareil
revenait au login suivant (le distant la « ressuscitait »).

## À faire côté Supabase (une fois)

SQL Editor → coller et exécuter `supabase/migrations/0012_user_documents.sql`
(table `user_documents` + RLS + index sur les opérations supprimées).
Sans la migration, l'app fonctionne comme avant : le push échoue en silence
et réessaie toutes les minutes.

## Comment ça marche

### Documents du compte (`src/lib/documentSync.ts`)
- Une ligne `user_documents (user_id, key, value, updated_at)` par clé
  localStorage suivie : profils, profil actif/défaut, objectifs d'épargne,
  poches (budgets, fonds, personnalisées), notes, plafonds par catégorie,
  report, correspondances CSV, règles récurrentes, suggestions écartées,
  drapeaux d'onboarding/tour/checklist, widgets d'accueil, fils de chat.
- Les écritures localStorage sont interceptées (`Storage.prototype.setItem`
  et `removeItem`, installé dans `main.tsx`) : toute clé suivie modifiée est
  poussée 2,5 s plus tard (upsert, `updated_at` posé par le serveur).
- À la connexion, `pullDocuments` compare chaque document distant avec la
  méta locale (`plan-financier-doc-sync-meta-v1`) : déjà vu → rien ; local
  modifié non poussé plus récent → le local gagne ; sinon le distant est
  écrit dans localStorage et l'app se recharge une fois pour relire son
  état. Un compte neuf n'a aucun document : pas de rechargement.
- Jamais synchronisés : clés IA personnelles, thème/palette/accessibilité,
  historique de chat par profil, PIN parent (appareil).
- Démo : synchro coupée (`setDocumentSyncUser(null)`).

### Suppressions d'opérations (`src/lib/pendingDeletes.ts`, `cloudSync.ts`)
- `deleteTransaction` et la suppression d'un profil mettent les ids en file
  (`plan-financier-pending-deletes-v1`).
- Au login et à chaque push, la file est envoyée en `deleted_at = now()`
  (`softDeleteTransactions`), puis vidée.
- Au login, les ids marqués supprimés côté serveur
  (`listDeletedTransactionIds`) sont retirés de l'appareil et exclus de la
  fusion : plus de zombies.
- Les comptes se synchronisent par archivage (`archived_at`), inchangé.

### Espace local par compte
Méta de synchro et file de suppressions suivent le compte (ajoutées à
`LOCAL_DATA_KEYS`) : un changement de compte sur le même appareil n'emporte
rien d'un compte à l'autre.

## Vérifier après déploiement
1. Appareil A connecté : créer une poche, un objectif, une note. Attendre 3 s.
2. Supabase → Table Editor → `user_documents` : les lignes apparaissent.
3. Appareil B (ou navigation privée) : se connecter → l'app se recharge une
   fois → poche, objectif et note sont là.
4. Supprimer une opération sur A → sur B, se déconnecter/reconnecter (ou
   recharger) : l'opération a disparu.

## Fichiers
- `supabase/migrations/0012_user_documents.sql`
- `src/lib/documentSync.ts` (+ tests), `src/lib/pendingDeletes.ts` (+ tests)
- `src/repos/transactionsSupabaseRepo.ts` : `softDeleteTransactions`,
  `listDeletedTransactionIds`
- `src/lib/cloudSync.ts` : `applyDeletions`, file de suppressions dans
  `syncWithCloud` et `pushToCloud` (+ tests)
- `src/lib/localWorkspace.ts`, `src/main.tsx`, `src/App.tsx`
