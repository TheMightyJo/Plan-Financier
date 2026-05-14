# Architecture cible — Plan Financier

> **Statut** : décision validée (Option C — Supabase) le 2026-05-14.
> **Auteur** : audit Claude.

---

## 1. Pourquoi une décision d'archi maintenant

Le roadmap produit liste plusieurs features qui ne tiennent **pas** dans l'architecture actuelle (full localStorage + Firebase Auth) :

| Feature roadmap | Bloqueur dans l'archi actuelle |
|---|---|
| Multi-comptes V1 (vue consolidée) | Pas de relation, pas de jointures |
| Mode famille (comptes partagés, vue qui-a-payé) | Single-device, pas de sync inter-utilisateurs |
| Notifications & rappels V2 | Pas de scheduler côté serveur |
| Scan reçus IA | Pas de Storage de fichiers |
| Mode hors-ligne avec sync au retour réseau | Aucune source de vérité distante à synchroniser avec |
| Widget écran d'accueil | A minima PWA installable + cache |
| Dépenses récurrentes auto-générées | OK en localStorage **mais** redonné à zéro à chaque appareil |
| Anonymisation IA (« l'IA ne connaît pas votre nom ») | Aujourd'hui la clé API est côté client → impossible de garantir l'anonymisation |

**Tant que cette décision n'est pas prise, on ne peut pas chiffrer le roadmap, ni dessiner les écrans manquants de manière cohérente.**

---

## 2. Options évaluées

| Critère | A. Status quo (localStorage + Firebase Auth) | B. Firestore + Firebase Auth + Firebase Storage | C. **Supabase** (Postgres + Auth + Storage + Realtime + Edge Functions) | D. Backend custom (Node + Postgres + S3) |
|---|---|---|---|---|
| Multi-device sync | ❌ | ✅ | ✅ | ✅ |
| Multi-utilisateurs / famille | ❌ | ✅ | ✅ | ✅ |
| Requêtes relationnelles (multi-comptes consolidés, agrégats famille) | ❌ | partiel (NoSQL) | ✅ (SQL natif) | ✅ |
| Realtime (vue famille live) | ❌ | ✅ | ✅ | ❌ (à coder) |
| Storage fichiers (scan reçus) | ❌ | ✅ Firebase Storage | ✅ Supabase Storage | S3 + code |
| Permissions fines (parent/enfant/viewer) | ❌ | rules Firestore (NoSQL, lourd) | ✅ RLS Postgres (déclaratif, audit-friendly) | code |
| Hosting EU / RGPD | local | US/EU mais Google | EU dispo (Frankfurt) | au choix |
| Anonymisation IA côté serveur | ❌ | Cloud Functions (verbeux) | Edge Functions Deno (proche du client) | OK |
| Ops & maintenance | 0 | 0 (managed) | 0 (managed) | élevée |
| Coût zéro à <500 users | ✅ | gratuit jusqu'à seuil | gratuit jusqu'à seuil (50k MAU, 500 MB DB) | hosting payant dès J1 |
| Lock-in | 0 | élevé (NoSQL Google) | **faible** (Postgres standard, exportable) | 0 |
| Effort de migration depuis l'état actuel | 0 | moyen | moyen | élevé |
| Clé API IA côté serveur (vraie confidentialité) | ❌ | Cloud Functions | Edge Functions | OK |

---

## 3. Décision : **Option C — Supabase**

### Justifications par ordre d'importance

1. **Postgres = bon fit relationnel**. Les besoins « multi-comptes consolidés », « vue famille avec qui-a-dépensé-quoi », « budgets par catégorie x mois », « historique récurrences » sont mal exprimés en NoSQL et naturels en SQL.
2. **Row-Level Security (RLS) Postgres** = règles déclaratives par table (`user owns row`, `user is member of family group`). Plus lisibles et auditables que les rules Firestore.
3. **Auth intégré** qui remplace 1:1 Firebase Auth (email/password + OAuth Google) → migration ciblée.
4. **Hosting EU** disponible (Frankfurt) → simplification RGPD / DPA / registre des traitements.
5. **Edge Functions Deno** = pipeline d'anonymisation IA côté serveur. La promesse charte « l'IA ne connaît pas votre nom » devient **réelle**, pas marketing.
6. **Realtime intégré** pour le mode famille (vue qui-vient-d'ajouter-quoi en live).
7. **Faible lock-in** : tout est Postgres standard. `pg_dump` + déployer ailleurs = fini.

### Trade-offs honnêtes

- **Migration Firebase Auth → Supabase Auth** : les utilisateurs existants devront se reconnecter (mot de passe à redéfinir). Acceptable vu la taille actuelle de la base.
- **Coût** : free tier Supabase couvre ~50k MAU et 500 MB DB ; au-delà, ~25 USD/mois pour le tier Pro.
- **Edge Functions** : moins matures que Cloud Functions Firebase, mais largement suffisantes pour le pipeline IA.
- **Migration depuis localStorage** : passage de "lecture/écriture synchrone localStorage" vers "asynchrone réseau avec optimistic UI". Gros chantier (cf. §6).

---

## 4. Schéma de base de données (ERD)

### Conventions
- Toutes les tables ont `id uuid pk`, `created_at timestamptz default now()`, `updated_at timestamptz`, `deleted_at timestamptz null` (soft delete).
- Tous les `*_id` sont des FK uuid.
- Les montants sont `numeric(12,2)` pour éviter les flottants.
- RLS activé sur **toutes** les tables, sans exception.

Le DDL complet est dans [supabase/migrations/0001_initial_schema.sql](../supabase/migrations/0001_initial_schema.sql). Vue d'ensemble :

```
auth.users ─┬─ profiles ─┬─ accounts (perso)
            │            │
            │            ├─ categories (custom)
            │            │
            │            ├─ budgets, savings_goals (perso)
            │            │
            │            ├─ ai_consents → ai_sessions → ai_session_messages
            │            │
            │            └─ audit_logs, rgpd_requests
            │
            └─ family_memberships ─ family_groups ─┬─ accounts (partagés)
                                                  │
                                                  ├─ budgets, savings_goals (famille)
                                                  │
                                                  └─ transactions (via accounts)

transactions ─┬─ account_id ─→ accounts
              ├─ category_id ─→ categories
              ├─ paid_by_user_id ─→ profiles
              └─ recurring_rule_id ─→ recurring_rules

receipts (Supabase Storage bucket privé, RLS par owner)
```

### Tables (résumé)

| Table | Rôle |
|---|---|
| `profiles` | 1:1 avec `auth.users`, préférences UI/IA/locale, consentement |
| `family_groups` | Groupe famille |
| `family_memberships` | Lien user ↔ famille avec rôle (parent/child/viewer) |
| `accounts` | Compte bancaire OU enveloppe budgétaire, perso ou famille (XOR) |
| `categories` | Catégories de transactions (système globales OU custom user) |
| `transactions` | Table centrale, lien vers `account` + `category` + `paid_by_user` |
| `recurring_rules` | "Loyer le 5 du mois, 1200€" — un cron Supabase génère les transactions |
| `budgets` | Plafond par catégorie x mois (perso ou famille) |
| `savings_goals` | Objectif d'épargne (vacances, voiture…) |
| `ai_consents` | Traçabilité RGPD du consentement par provider IA |
| `ai_sessions` | Une conversation IA = une session, avec pseudonyme aléatoire |
| `ai_session_messages` | Messages déjà anonymisés à l'écriture |
| `audit_logs` | RGPD : qui a accédé / modifié / exporté quoi |
| `rgpd_requests` | Droit d'accès, droit à l'oubli |

---

## 5. RLS — exemples-clés

**Principe** : un user ne peut lire/écrire que ses propres rows OU celles d'un `family_group` dont il est membre. Le `service_role` (uniquement Edge Functions) a tous les droits.

```sql
-- transactions : lecture seulement si on possède le compte ou si famille
create policy "transactions_select_own_or_family" on transactions for select using (
  exists (
    select 1 from accounts a
    where a.id = transactions.account_id
      and (
        a.owner_user_id = auth.uid()
        or a.family_group_id in (
          select family_group_id from family_memberships
          where user_id = auth.uid() and accepted_at is not null
        )
      )
  )
);

-- audit_logs : un user ne peut JAMAIS modifier ses propres logs
create policy "audit_insert_only" on audit_logs for insert with check (user_id = auth.uid());
revoke update, delete on audit_logs from authenticated;
```

Toutes les policies sont dans la migration `0001_initial_schema.sql`.

---

## 6. Plan de migration depuis l'archi actuelle

> But : ne pas casser les utilisateurs existants. Migration **incrémentale**, pas big-bang.

### Étape 0 — Préparatoire (cette PR ✅)
- Schéma SQL versionné prêt (`supabase/migrations/0001_initial_schema.sql`)
- `supabase/config.toml` template, `.env.example`
- Charte graphique appliquée comme tokens CSS
- Doc d'archi (ce fichier) versionnée

### Étape 1 — Auth (1 sprint)
- Créer le projet Supabase EU
- Migrer `AuthScreen.tsx` de Firebase Auth vers `@supabase/supabase-js`
- Email aux utilisateurs existants : « réinitialisez votre mot de passe »
- Supprimer le projet Firebase Auth + le fichier `src/firebase.ts`
- **Gain immédiat** : auth depuis n'importe quel device avec le même compte.

### Étape 2 — Sync transactions (2 sprints)
- Pattern repository : `transactionsRepo.list()`, `.create()`, `.update()`...
- Implémentation 1 : localStorage (l'actuelle, conservée comme cache offline)
- Implémentation 2 : Supabase
- Stratégie : **read-through + write-through** avec optimistic UI
- Au premier login post-migration : push localStorage → Supabase

### Étape 3 — Famille + comptes partagés (2 sprints)
- UI création/invitation famille
- UI création comptes partagés
- Realtime channel par `family_group` pour la vue live

### Étape 4 — Anonymisation IA (1 sprint)
- Edge Function `/anonymize-and-forward` (Deno)
- Pipeline : strip PII → forward provider → store anonymized message → return reply
- Migrer la clé API IA du client vers Supabase secrets
- Mettre à jour le composant chat pour pointer sur l'edge function

### Étape 5 — Récurrences + budgets + objectifs côté serveur (3 sprints)
- Cron Supabase nightly pour générer les transactions récurrentes
- UI budgets par catégorie/mois
- UI objectifs d'épargne avec progression auto-calculée

### Étape 6 — Storage reçus + scan IA (2 sprints)
- Bucket privé `receipts/`, RLS par owner
- Upload côté client → analyse OCR via edge function (Anthropic/OpenAI vision)
- Pré-remplissage formulaire transaction

### Étape 7 — PWA + offline-first (2 sprints)
- Manifest PWA + Service Worker
- File d'attente d'écritures offline (IndexedDB), flush au retour réseau
- Indicateur UI « hors ligne / synchronisation en cours »

**Total estimé : 13 sprints (~6 mois) si dev solo plein-temps, ~9 mois si half-time.**

---

## 7. Ce qui change concrètement dans le code

| Fichier actuel | Devient |
|---|---|
| `src/firebase.ts` | `src/supabase.ts` (étape 1) |
| `src/AuthScreen.tsx` | mêmes UI, calls Supabase Auth (étape 1) |
| `src/security.ts` | conservé pour le PIN parent local |
| `src/App.tsx` (localStorage everywhere) | `src/repos/*` qui encapsulent l'accès données (étape 2) |
| `src/types.ts` (déjà extrait ✅) | enrichi avec types DB générés via `supabase gen types typescript` |
| `firestore.rules` / `storage.rules` | supprimés à l'étape 1 (Firebase plus utilisé) |

---

## 8. Risques & inconnues à valider

1. **Coût** à modéliser sur 100/500/1000 users actifs.
2. **Migration des données existantes** : combien d'utilisateurs ont du contenu en localStorage ? Si > quelques dizaines, prévoir un script d'import dédié.
3. **Conformité RGPD** : avec Supabase EU + DPA signé, on couvre. À documenter dans une page « politique de confidentialité ».
4. **Choix du provider IA par défaut** : l'edge d'anonymisation aura besoin de connaître le format attendu par le provider (différent OpenAI/Anthropic/Mistral/Google).
5. **Mode famille** : représente ~5 sprints à lui seul. À confirmer comme V1 ou différer en V2.
