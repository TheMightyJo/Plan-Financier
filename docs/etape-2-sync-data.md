# Étape 2 — Sync data localStorage ↔ Postgres

> **Statut** : 2.A livrée (foundations) — 2.B et 2.C à venir
> **Référence archi** : [docs/architecture.md](architecture.md) §6 étape 2
> **Date** : 2026-05-16

---

## Contexte

L'app stocke en V1 toutes les données métier en localStorage. Pour débloquer le
multi-device (et préparer le mode famille étape 3), il faut basculer vers
Postgres Supabase tout en gardant le localStorage comme cache offline.

## Découpage en 3 phases

| Phase | Contenu | Risque | Statut |
|---|---|---|---|
| **2.A** | Foundations (mappers, repos abstraits, bootstrap idempotent) | 🟢 Zéro (pas de wire App.tsx) | ✅ Livré |
| **2.B** | Migration `Transaction.id: number → string` + wire bootstrap au login | 🟠 ~30 refs dans App.tsx à mettre à jour | ⏳ |
| **2.C** | Wrapper setTransactions dual-write + pull multi-device + UI sync status | 🟠 Optimistic UI + gestion conflits | ⏳ |

---

## Phase 2.A — Foundations (cette session ✅)

### Fichiers livrés

| Fichier | Rôle |
|---|---|
| `src/lib/supabaseMappers.ts` | TS↔Postgres bidirectionnels pour Account, Transaction, RecurringRule, SavingsTarget. Inclut `ensureUuid()` et `newUuid()`. |
| `src/lib/supabaseMappers.test.ts` | 21 tests round-trip + cas limites (orphan accountId, paused rules, achieved goals, etc.) |
| `src/repos/types.ts` | Interface générique `SyncRepo<T>` (`list/upsert/upsertMany/delete`) + type `SyncResult` |
| `src/repos/transactionsSupabaseRepo.ts` | Implémentation Supabase pour les transactions |
| `src/repos/accountsSupabaseRepo.ts` | Implémentation Supabase pour les comptes |
| `src/lib/syncBootstrap.ts` | Helper `bootstrapPushLocalToRemote(userId, accounts, transactions)` idempotent (flag localStorage par user) |

### Limitations 2.A explicites

- ⚠️ **Wire App.tsx pas fait** : les nouveaux repos ne sont pas encore appelés. L'app continue à fonctionner exactement comme avant. C'est volontaire pour livrer une PR review-friendly et zéro régression.
- ⚠️ **Catégorie + enveloppe perdus au round-trip** : `transactionToRow` met `category_id = null`. Le `transactionFromRow` retourne `'Autre'` / `'Perso'` par défaut. Ces deux champs métier n'existent pas encore comme colonnes Postgres. À ajouter en 2.B via migration `0002_add_category_envelope.sql`.
- ⚠️ **Transaction.id reste `number`** : `transactionFromRow` fait un hash uuid → number pour compatibilité. La vraie migration vers `string` se fait en 2.B (cf. §Stratégie ID).
- ⚠️ **Push-only** : `syncBootstrap` ne fait QUE pousser local → distant. Aucune lecture depuis Postgres. Le multi-device reste théorique tant que 2.C n'est pas livrée.
- ⚠️ **Pas de mode famille** : tous les inserts utilisent `owner_user_id = current user`, `family_group_id = null`. Mode famille = étape 3.

---

## Stratégie d'ID (point critique 2.B)

### État actuel V1
- `Account.id`, `RecurringRule.id`, `SavingsTarget.id` : déjà `string`. Compatible uuid Postgres.
- **`Transaction.id` : `number`** (généré via `Date.now()`). **Incompatible** avec `id uuid primary key` côté SQL.

### Stratégie proposée pour 2.B

**Option A** (recommandée) : migration unique au load
1. Au mount, scanner toutes les transactions stockées avec id number.
2. Pour chaque, générer un uuid déterministe via `ensureUuid(oldId)` (déjà implémenté en 2.A).
3. Mettre à jour le localStorage avec les nouveaux ids.
4. Toutes les nouvelles transactions utilisent `newUuid()` à la création.
5. Changer `Transaction.id` type : `number` → `string`. Mettre à jour ~30 refs dans App.tsx.

**Avantages** :
- 1 commit unique, atomique côté user
- Pas de logique double-format à maintenir
- IDs serveur stables (même avant push, l'uuid est généré client-side)

**Risques** :
- Beaucoup de touches dans App.tsx (key={item.id}, deleteTransaction(id), comparaisons editingTxId === item.id)
- L'oubli d'un cast `Number(id)` → bug runtime
- Mitigation : TypeScript strict catchera la majorité

**Option B** (rejetée) : table de correspondance number ↔ uuid en localStorage. Trop de complexité pour zéro bénéfice.

### Plan d'exécution 2.B (session dédiée, ~3-4h)

1. Migration `0002_add_category_envelope.sql` :
   ```sql
   alter table transactions add column category_label text;
   alter table transactions add column envelope_label text;
   ```
   (On stocke en text au lieu de référencer `categories.id` car les catégories TS sont énumérées, pas dynamiques en V1.)

2. Mettre à jour `supabaseMappers.ts` pour pousser category + envelope.

3. Changer `Transaction.id` type : `number` → `string` dans `src/types.ts`.

4. Fonction migration localStorage : `migrateTransactionIds()` qui scanne, génère uuid déterministe, réécrit.

5. App.tsx : remplacer tous les `tx.id : number` par string. Adapter `editingTxId`, `deletingTxId`, `nextId()` dans `generateDueTransactions`, etc.

6. Au login authentifié : `bootstrapPushLocalToRemote()` appelé une fois.

7. Tests : vérifier que ouvrir l'app avec des transactions legacy migre proprement, et que les nouvelles transactions vont en Postgres.

---

## Plan 2.C (session future, ~1 sprint)

### Sync continu

Au lieu de seulement bootstrap, chaque mutation doit aussi écrire en Postgres :

```ts
// Avant
setTransactions((prev) => [...prev, newTx])

// Après
setTransactions((prev) => [...prev, newTx])         // optimistic local
void transactionsSupabaseRepo.upsert(newTx)         // sync server BG
```

Wrapper centralisé pour ne pas répéter la logique partout :

```ts
const syncedSetTransactions = useCallback((updater) => {
  setTransactions((prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater
    const diff = computeDiff(prev, next)
    diff.added.forEach((t) => void transactionsSupabaseRepo.upsert(t))
    diff.updated.forEach((t) => void transactionsSupabaseRepo.upsert(t))
    diff.deleted.forEach((t) => void transactionsSupabaseRepo.delete(t.id))
    return next
  })
}, [])
```

### Pull au login (multi-device)

```ts
useEffect(() => {
  if (!isAuthenticated) return
  void (async () => {
    const { data: remoteTxs } = await transactionsSupabaseRepo.list()
    const { data: remoteAccounts } = await accountsSupabaseRepo.list()
    // Merge local ↔ distant par updatedAt (last-write-wins)
    setTransactions(mergeByUpdatedAt(localTransactions, remoteTxs))
    setAccounts(mergeByUpdatedAt(localAccounts, remoteAccounts))
  })()
}, [isAuthenticated])
```

### UI sync status

- Badge persistant dans la nav : `🟢 Synchronisé` / `🟠 Sync en cours` / `🔴 Sync échouée`
- Click sur badge → modal détaillant : dernière sync OK, file d'attente d'écritures, bouton "Réessayer maintenant"

### Conflits

V1 : last-write-wins par timestamp `updated_at`. Acceptable pour 99% des cas (peu probable que 2 devices modifient la même transaction dans la même seconde).

V3 (futur) : CRDT type [Yjs](https://github.com/yjs/yjs) ou [Automerge](https://automerge.org/) pour conflits sans perte. Hors scope V2.C.

### Mode offline

V1.5 : Service Worker + IndexedDB queue. Les écritures faites offline sont stockées, flushées au retour réseau. Cf. étape 7 archi.

---

## Tests à prévoir 2.B + 2.C

- Migration ID `migrateTransactionIds()` : roundtrip number → uuid → reconvertit ok
- Conflict resolution : 2 versions divergentes d'une transaction, merge par `updatedAt`
- Network failure : `upsert()` retourne `{ ok: false, error: 'network' }` → l'optimistic UI ne rollback PAS (déjà visible en local), mais une re-tentative est planifiée
- RLS failure : un user qui tenterait d'écrire avec un `id` déjà pris par un autre user → `error: 'conflict'`

---

## Métriques de succès 2.B + 2.C

- ✅ Un user crée une transaction sur device A → la voit sur device B après refresh (< 2s)
- ✅ Un user édite une transaction offline → modifiée localement, synchronisée au retour réseau
- ✅ Pas de duplication de transactions après bootstrap (idempotence)
- ✅ Pas de transaction perdue en cas de pertur réseau
- ✅ Latence UI : 0ms perçue (optimistic), sync server en arrière-plan
