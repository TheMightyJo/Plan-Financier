# Cahier des charges — Plan Financier

> **Version** : 1.0
> **Date** : 2026-05-15
> **Statut** : V1 (étape 0–1 livrée, étapes 2–7 à venir)
> **Audience** : développeur·se solo, agence freelance, futur·e CTO du projet
> **Document compagnon** : [docs/architecture.md](architecture.md), [brand_identity_plan_financier.html](../brand_identity_plan_financier.html)

---

## Table des matières

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Contexte & vision produit](#2-contexte--vision-produit)
3. [Cibles & personas](#3-cibles--personas)
4. [Architecture technique](#4-architecture-technique)
5. [Confidentialité, RGPD & sécurité](#5-confidentialité-rgpd--sécurité)
6. [Charte graphique & langage UI](#6-charte-graphique--langage-ui)
7. [Catalogue fonctionnel](#7-catalogue-fonctionnel)
8. [Catalogue d'écrans](#8-catalogue-décrans)
9. [APIs externes & intégrations](#9-apis-externes--intégrations)
10. [Roadmap chiffrée](#10-roadmap-chiffrée)
11. [Critères d'acceptation V1](#11-critères-dacceptation-v1)
12. [Annexes & glossaire](#12-annexes--glossaire)

---

## 1. Synthèse exécutive

**Plan Financier** est une application web de gestion budgétaire familiale, accessible depuis n'importe quel navigateur, conçue pour les foyers francophones qui veulent reprendre la main sur leur argent **sans confier leurs données à un agrégateur bancaire**.

### Promesses produit

- **Saisie en 3 taps** : ajouter une dépense ne doit jamais prendre plus de 5 secondes.
- **Multi-comptes consolidés** : compte courant + livret + cash + investissement, avec une vue patrimoine net unique.
- **Mode famille** (V2+) : comptes partagés, vue qui-a-payé-quoi, équilibrage des charges.
- **IA respectueuse** : *« L'IA ne connaît pas votre nom. Elle voit des tendances, pas vos transactions. »*
- **100 % côté navigateur** au démarrage, **multi-device synchro** dès l'étape 1 (Supabase EU).

### État au 2026-05-15

| Bloc | État |
|---|---|
| Décision d'archi (Supabase) | ✅ Validée |
| ERD Postgres (14 tables, RLS) | ✅ Versionné dans `supabase/migrations/0001_initial_schema.sql` |
| Charte graphique (tokens CSS) | ✅ Appliquée |
| Multi-comptes V1 | ✅ Livré |
| Dépenses récurrentes | ✅ Livré |
| Historique transactions (recherche/filtre/CSV) | ✅ Livré |
| Page objectifs d'épargne (échéance + mensualité) | ✅ Livré |
| Auth Supabase (étape 1 archi) | ✅ Livré |
| Responsive mobile-first | ✅ Garanti |
| Mode famille (étape 3 archi) | ⏳ À venir |
| Anonymisation IA serveur (étape 4) | ⏳ À venir |
| Dépenses récurrentes côté serveur (cron) | ⏳ À venir (étape 5) |
| Scan reçus IA (étape 6) | ⏳ À venir |
| PWA + offline-first (étape 7) | ⏳ À venir |

### Stack technique cible

- **Front** : React 19, TypeScript strict, Vite, CSS vanilla via tokens.
- **Auth** : Supabase Auth (email/password + Google OAuth, hosting EU Frankfurt).
- **Données** : Supabase Postgres + RLS (étape 2 et au-delà). LocalStorage utilisé en cache offline.
- **Realtime** : Supabase Realtime (mode famille).
- **IA** : Edge Functions Supabase pour l'anonymisation, providers Anthropic / OpenAI / Mistral / Google / OpenRouter.
- **Storage** : Supabase Storage (scan reçus, étape 6).
- **Tests** : Vitest, jsdom, Testing Library. **102 tests unitaires** au 2026-05-15.

### Effort estimé

- **Étape 0–1 (foundation + auth)** : ✅ livré.
- **Étapes 2–7 (sync data → famille → IA serveur → cron → reçus → PWA)** : ~12 sprints (~6 mois plein-temps, ~9 mois mi-temps).

---

## 2. Contexte & vision produit

### 2.1 Problème adressé

Les utilisateurs francophones ont aujourd'hui le choix entre :

| Catégorie | Représentants | Limites perçues |
|---|---|---|
| Agrégateurs bancaires | Bankin', Linxo, Yolt | Connecteurs Open Banking → données entières chez un tiers, modèle pub/affilié, pas de mode famille fin |
| Tableurs faits maison | Excel / Google Sheets | Friction de saisie, pas de mobile, pas de coaching, partage compliqué |
| Apps de couple | Splitwise, Tricount | Excellents pour le partage ponctuel, faibles pour le suivi continu |
| Apps banque "premium" | Revolut, N26 | Excellent pour leur banque, opaques sur le multi-banque |

**Plan Financier** se positionne sur l'intersection : **suivi consolidé multi-banque + mode famille fin + confidentialité forte**, sans dépendre d'un agrégateur.

### 2.2 Différenciateurs

1. **Saisie manuelle assumée comme un choix produit, pas une limitation.**
   La saisie est rendue rapide (3 taps, IA de catégorisation, scan reçus, dépenses récurrentes auto), pas reportée à un connecteur bancaire fragile.
2. **Confidentialité réelle, pas marketing.**
   Pipeline d'anonymisation IA côté serveur (Edge Function) : noms et montants exacts strippés avant envoi au provider IA. Hosting EU + RLS Postgres.
3. **Mode famille natif, granularité parent/enfant/viewer.**
   Pas un add-on, conçu dans le schéma de données dès J1 (`family_groups` + `family_memberships` avec rôle).
4. **PIN parent local** en plus de l'auth — protège l'accès depuis un appareil partagé.
5. **Open layout** : tout est tokenisé (CSS), tout est versionné en SQL — pas de magie noire.

### 2.3 Hors scope V1 (à clarifier explicitement)

- ❌ **Connecteur Open Banking** (DSP2 / Bridge / Tink) — décision : repoussé en V3 minimum, peut-être jamais.
- ❌ **App native iOS/Android** — V1 = PWA installable suffisante.
- ❌ **Conseil financier régulé** (assurance, crédit, placements) — l'IA donne des suggestions générales, pas de conseil régulé AMF.
- ❌ **Crypto / actifs non-€** — pas en V1, peut-être V3+ via la table `accounts.type = 'investment'`.
- ❌ **Multi-devise** — UI tout en EUR, le champ `currency` existe en SQL pour le futur.

### 2.4 Indicateurs de succès produit

| KPI | Cible 12 mois |
|---|---|
| Activation : % users qui saisissent ≥ 5 transactions dans les 7 jours | 60 % |
| Rétention W4 (% users actifs au 28e jour) | 35 % |
| % users multi-comptes (≥ 2 comptes actifs) | 50 % |
| % users mode famille (≥ 2 membres) | 25 % |
| NPS (échantillon trimestriel) | ≥ 40 |
| Coût d'acquisition / user | < 5 € |

---

## 3. Cibles & personas

### 3.1 Persona principal — Marie, 38 ans

**Situation** : couple, 2 enfants (8 et 11 ans), 2 salaires confortables, ~3 comptes (un courant chacun, un livret familial), un crédit immo en cours.

**Pain actuel** :
- Tient un Excel partagé Drive — Excel se traîne, son mari ne le met jamais à jour.
- A testé Bankin', a arrêté quand l'app a perdu la connexion bancaire pendant 3 semaines.
- Ne sait jamais combien il « reste vraiment à dépenser » à mi-mois.

**Ce qu'elle attend** :
- Saisir une transaction depuis le métro en 5 secondes.
- Voir « il vous reste 340 € sur ce mois » d'un coup d'œil.
- Que son mari puisse contribuer aux saisies sans que ça devienne une corvée.
- Que ses données ne soient PAS partagées avec un agrégateur ou un assureur.

**Mots-clés émotionnels** : sérénité, contrôle, transparence, sans culpabilisation.

### 3.2 Persona secondaire — Antoine, 28 ans

**Situation** : célibataire, 1 salaire, 1 compte courant + 1 PEA + 1 livret A. Vit en colocation, dépenses partagées avec 2 colocs.

**Pain actuel** :
- Utilise Splitwise pour la coloc, Excel pour son budget perso. Friction de double saisie.
- Ne suit pas son épargne — ne sait pas où il en est par rapport à son objectif "30 k€ d'apport".

**Ce qu'il attend** :
- Une vue épargne claire : « il te reste 18 mois pour atteindre ton objectif à ton rythme actuel ».
- Pouvoir saisir une dépense partagée et l'attribuer (V2+).
- Un mode dark/sombre pour le soir.

### 3.3 Persona contre-exemple — qui Plan Financier N'EST PAS POUR

- **Investisseur actif** qui veut suivre la performance de son portefeuille en temps réel → Bourse Direct ou Trade Republic.
- **TPE / freelance** qui veut faire sa compta pro → Tiime ou Indy.
- **Personne qui veut éviter toute saisie manuelle** → ils cherchent un agrégateur (Bankin').

---

## 4. Architecture technique

> Cette section synthétise. Le détail (comparatif d'options, justifications, plan migration) est dans [docs/architecture.md](architecture.md).

### 4.1 Décision : Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)

**Raisons clés** :
1. Postgres relationnel = bon fit pour multi-comptes, famille, budgets, agrégats.
2. RLS Postgres = permissions déclaratives lisibles vs rules NoSQL fouillis.
3. Auth EU intégré → migration Firebase ciblée (déjà faite).
4. Edge Functions Deno → pipeline anonymisation IA côté serveur.
5. Faible lock-in (Postgres standard, `pg_dump` portable).

### 4.2 Schéma Postgres (14 tables)

| Table | Rôle |
|---|---|
| `profiles` | 1:1 avec `auth.users`, préférences UI/IA/locale, consentement IA |
| `family_groups` | Groupe famille |
| `family_memberships` | Lien user ↔ famille avec rôle (parent / child / viewer) |
| `accounts` | Compte bancaire OU enveloppe budgétaire (perso XOR famille) |
| `categories` | Catégories de transactions (système globales OU custom user) |
| `transactions` | Table centrale (account, category, paid_by, transfer_group_id) |
| `recurring_rules` | "Loyer le 5 du mois, 1200 €" — cron Supabase génère les transactions |
| `budgets` | Plafond par catégorie × mois (perso ou famille) |
| `savings_goals` | Objectif d'épargne (vacances, voiture…) avec target_date + destination_account |
| `ai_consents` | Traçabilité RGPD du consentement par provider IA |
| `ai_sessions` | Une conversation IA = une session, avec pseudonyme aléatoire |
| `ai_session_messages` | Messages anonymisés à l'écriture |
| `audit_logs` | RGPD : qui a accédé / modifié / exporté quoi (insert-only) |
| `rgpd_requests` | Droit d'accès, droit à l'oubli |

DDL complet, RLS, triggers : [supabase/migrations/0001_initial_schema.sql](../supabase/migrations/0001_initial_schema.sql).

### 4.3 RLS — principe

Chaque user n'accède qu'à :
- Ses propres rows (filtré sur `owner_user_id = auth.uid()`)
- Les rows des `family_groups` dont il est membre actif (via helper `is_family_member()`)
- En écriture famille : seuls les `parent` (via helper `is_family_parent()`)

`audit_logs` est en `INSERT only` — `UPDATE` et `DELETE` revoke depuis `authenticated`.

### 4.4 Découpage front

```
src/
├── App.tsx                    # Coquille principale + routing-like
├── AppErrorBoundary.tsx       # Boundary global
├── AuthScreen.tsx             # Connexion/inscription/reset password
├── supabase.ts                # Client Supabase + garde-fou env vars
├── security.ts                # PIN parent (PBKDF2 hashed local)
├── types.ts                   # Types métier partagés
├── styles/
│   └── tokens.css             # Tokens charte (palette, typo, radius, spacing)
├── lib/
│   ├── accounts.ts            # Helpers comptes (balance, consolidation)
│   ├── categories.ts          # Catégories + couleurs
│   ├── dates.ts               # Helpers dates
│   ├── format.ts              # Formatters EUR
│   ├── recurring.ts           # Génération transactions récurrentes
│   ├── savingsGoals.ts        # Mensualité conseillée, statut
│   ├── text.ts                # Normalisation, similarité
│   └── transactionFilters.ts  # Filtres + tri + CSV
├── repos/
│   ├── accountsRepo.ts        # Persistance accounts (localStorage v1)
│   └── recurringRulesRepo.ts  # Persistance recurring rules
└── components/
    ├── AccountsPanel.tsx
    ├── FirstTransactionTour.tsx
    ├── RecurringRulesPanel.tsx
    ├── SavingsGoalsPanel.tsx
    └── TransactionHistoryPanel.tsx
```

**Convention** : tout helper testable est dans `src/lib/` (zéro dépendance React). UI dans `src/components/`. Persistance abstraite dans `src/repos/` (swap Supabase = remplacer l'implémentation).

### 4.5 Plan de migration en 7 étapes

| Étape | Contenu | État | Effort |
|---|---|---|---|
| 0 | Préparatoire (schéma, config, charte tokens) | ✅ | 1 sprint |
| 1 | Auth Supabase | ✅ | 1 sprint |
| 2 | Sync transactions (read-through + write-through) | ⏳ | 2 sprints |
| 3 | Famille + comptes partagés + Realtime | ⏳ | 2 sprints |
| 4 | Edge Function anonymisation IA | ⏳ | 1 sprint |
| 5 | Cron récurrences + budgets + objectifs serveur | ⏳ | 3 sprints |
| 6 | Storage reçus + scan IA OCR | ⏳ | 2 sprints |
| 7 | PWA + offline-first | ⏳ | 2 sprints |

**Total restant : ~12 sprints (~6 mois plein-temps, ~9 mois mi-temps).**

---

## 5. Confidentialité, RGPD & sécurité

### 5.1 Niveaux de protection

| Donnée | Stockage actuel | Stockage cible (étape 2+) |
|---|---|---|
| Email + mot de passe | Supabase Auth (EU) | Supabase Auth (EU) |
| PIN parent | localStorage hashé PBKDF2 200k | localStorage (reste local — non synchronisé) |
| Transactions | localStorage | Postgres + RLS |
| Comptes | localStorage | Postgres + RLS |
| Objectifs / récurrences | localStorage | Postgres + RLS |
| Conversations IA | localStorage (clé API user) | Anonymisées en Edge Function, stockées en Postgres |
| Reçus / pièces jointes | n/a | Supabase Storage bucket privé + RLS |

### 5.2 Conformité RGPD

- **Hosting EU** : projet Supabase région Frankfurt.
- **DPA** signé avec Supabase (à faire par l'utilisateur du projet).
- **Droit d'accès** : table `rgpd_requests` + Edge Function qui exporte un ZIP des données du user (V2).
- **Droit à l'oubli** : trigger CASCADE depuis `auth.users → profiles` qui propage à toutes les tables liées.
- **Audit trail** : table `audit_logs` immuable (revoke UPDATE/DELETE), trace login / export / suppression / changement de PIN.
- **Consentement IA** : table `ai_consents` versionne (`terms_version`) + horodate (`consent_given_at` / `consent_revoked_at`) le consentement par provider.
- **Pas d'IP brute stockée** — `audit_logs.ip_country` stocke uniquement le code pays (2 lettres).

### 5.3 Pipeline d'anonymisation IA (étape 4)

```
Client envoie : "j'ai dépensé 487€ chez Carrefour Boulogne hier"
   ↓ (Edge Function /anonymize-and-forward)
Strip PII serveur :
  - Noms propres (regex + dictionnaire) → {{NAME_1}}
  - Montants exacts → arrondis à la centaine
  - Lieux → ville → région
   ↓
Forward au provider IA : "j'ai dépensé environ 500€ en grande surface en région parisienne hier"
   ↓
Réponse provider stockée en `ai_session_messages.content_anonymized`
   ↓
UI ré-injecte les valeurs originales pour l'affichage local
```

Le provider IA ne reçoit jamais de données identifiantes. La promesse charte « *L'IA ne connaît pas votre nom* » devient vérifiable.

### 5.4 Sécurité côté client

- **CSP** restrictive dans `index.html` : `default-src 'self'`, `connect-src` limité aux providers IA déclarés + endpoints Supabase, `object-src 'none'`.
- **PIN parent** : PBKDF2-SHA256 200k itérations + sel aléatoire 16 octets. Comparaison à temps constant (anti-timing attack).
- **AppErrorBoundary** capture les exceptions React, propose retry / reload / déconnexion + copy report incident.
- **TypeScript strict** activé.
- **Pas de `dangerouslySetInnerHTML`, `eval`, `any`** dans le code applicatif (audité).

---

## 6. Charte graphique & langage UI

> Source de vérité : [brand_identity_plan_financier.html](../brand_identity_plan_financier.html)
> Tokens CSS : [src/styles/tokens.css](../src/styles/tokens.css)

### 6.1 Palette

| Rôle | Hex | Token |
|---|---|---|
| Primaire (CTA, terre chaude) | `#8B6C52` | `--pf-color-primary` |
| Texte café | `#3D2B1F` | `--pf-color-text-primary` |
| Texte caramel | `#A08060` | `--pf-color-text-secondary` |
| Crème (fond) | `#FDFAF6` | `--pf-color-bg` |
| Sable (élevé) | `#F5EFE6` | `--pf-color-bg-elevated` |
| Lin (bordure) | `#D6C5B0` | `--pf-color-border` |
| Vert forêt (revenus, succès) | `#3A7D44` | `--pf-color-positive` |
| Terracotta (dépenses, danger) | `#C05C2A` | `--pf-color-negative` |
| Ambre doré (warning) | `#B8963E` | `--pf-color-warning` |
| Prune doux (IA) | `#6B5B8A` | `--pf-color-ai` |

### 6.2 Typographie

- Sans-serif : `Inter` ou `DM Sans` (fallback systèmes), poids 500 pour les titres.
- Échelle : 28 / 20 / 15 / 14 / 12 / 11 px.
- `letter-spacing` -0.5px sur titres, +0.07em sur méta/labels uppercase.

### 6.3 Composants

- **Boutons** : radius 10 px, padding 11×22, weight 500. Variants `primary` (terre), `secondary` (transparent + border lin), `ghost` (sable doux).
- **Inputs** : radius 10 px, border lin, fond crème, focus shadow ambre `--pf-shadow-focus`.
- **Cards (glass-card)** : radius 12-16 px, border 0.5 px subtle, shadow doux.
- **Badges** : radius pill 20 px, fond pâle + texte saturé selon sémantique (succès / warning / danger / IA).

### 6.4 Voix & ton

| Trait | Application |
|---|---|
| Bienveillant | « Vous avez bien géré ce mois » plutôt que « vous avez dépassé X » |
| Simple | Pas de jargon financier (pas de "TAEG", "encours", "ratio d'endettement") |
| Honnête | « L'IA ne connaît pas votre nom » seulement quand c'est vrai |
| Sans jargon | Préférer "compte courant" à "checking account", "enveloppe" à "bucket" |
| Rassurant | Confirmer chaque action ("Transaction supprimée", "PIN mis à jour") |
| Jamais culpabilisant | Pas de rouge agressif sur "vous avez trop dépensé" — utiliser ambre + ton conseil |

### 6.5 Responsive

**Règle stricte** (cf. [memory/feedback_responsive.md](../../../.claude/projects/-Users-johanquille-Documents-GitHub-Plan-Financier/memory/feedback_responsive.md)) :
- Mobile-first dès la première version, pas en patch.
- Tester à 320 px (iPhone SE) avant tout commit.
- Toute grille `1fr 1fr` doit avoir une `@media (max-width: 480px) { 1fr }`.
- Tout header titre+CTA doit pouvoir s'empiler en mobile.

---

## 7. Catalogue fonctionnel

### 7.1 Authentification (✅ V1)

| Feature | Description |
|---|---|
| Inscription email/password | Validation 8 caractères min, confirmation, email unique |
| Connexion email/password | Reset password via lien email |
| Connexion Google OAuth | Redirect via `signInWithOAuth({ provider: 'google' })` |
| Persistance session | Auto-refresh token, storage clé `plan-financier-supabase-auth` |
| PIN parent local | 4–6 chiffres, hash PBKDF2 stocké, sessions 7/14/30 jours configurables |
| Garde-fou config | Bandeau si env vars Supabase manquent — empêche page blanche silencieuse |

### 7.2 Comptes (✅ V1)

| Feature | Description |
|---|---|
| 6 types de comptes | Courant, Livret/Épargne, Espèces, Enveloppe budgétaire, CB, Investissement |
| Solde courant | initialBalance + somme(revenus) − somme(dépenses) liés au compte |
| Solde consolidé | Somme des soldes des comptes actifs d'un membre |
| Breakdown par type | Vue patrimoine ventilé (combien en courant, combien en épargne, etc.) |
| Archivage | Soft delete via `archived_at` ; le compte reste consultable mais sort des stats live |
| Suppression conditionnelle | Refusée si transactions liées (force l'archivage) |
| Migration auto | Transactions historiques sans `accountId` rebasculées sur "Compte courant" par défaut |

### 7.3 Transactions (✅ V1)

| Feature | Description |
|---|---|
| Saisie | Label, montant, catégorie (auto-déduite via mots-clés), enveloppe, date, type, compte |
| Édition / suppression | Inline avec confirmation, dans le panel historique |
| Recherche | Insensible à la casse + accents, sur label / catégorie / enveloppe |
| Filtres | Type, catégorie, enveloppe, compte, période (Tout / Mois / 3 derniers mois / Année / Custom) |
| Tris | Date desc/asc, montant desc/asc |
| Stats agrégées | Compteur, revenus, dépenses, net en bandeau live |
| Export CSV | Du résultat filtré, séparateur `;`, virgule décimale, BOM UTF-8 (Excel fr-FR friendly) |
| Import CSV bancaire | Mapping de colonnes, prévisualisation, détection doublons (V0 existant) |

### 7.4 Dépenses récurrentes (✅ V1)

| Feature | Description |
|---|---|
| 4 fréquences | Hebdo, mensuel, trimestriel, annuel |
| Jour configurable | 1-7 (ISO) pour weekly, 1-31 pour monthly (clamp au dernier jour si invalide) |
| Génération auto | Au mount, transactions manquantes générées depuis `lastGeneratedOn + 1` |
| Idempotent | Refresh = pas de doublons (`lastGeneratedOn` mis à jour) |
| Pause / reprise | Sans suppression, occurrences manquées non rattrapées |
| Édition | Tous les champs |
| Date de fin | Optionnelle (pour bail, abonnement annulé, etc.) |

### 7.5 Objectifs d'épargne (✅ V1)

| Feature | Description |
|---|---|
| Création | Nom, montant cible, date cible (optionnelle), couleur |
| Lien compte | Optionnel : si lié, progression = solde du compte. Sinon, manuel |
| Mensualité conseillée | (Cible − Épargné) / mois restants — avertit si "tendu" (>30% du restant à mettre) |
| Statut | Achieved / On track / Late / Tight (calculé) |
| Marquer atteint | Verrou via `achievedAt` (réversible) |
| Barre progression | Couleur custom, clampée 0..100% |

### 7.6 Budgets par enveloppe (V2)

| Feature | Description |
|---|---|
| Plafond par catégorie × mois | Ex. "max 400 € courses en mai" |
| Rollover | Reporter le solde non dépensé sur le mois suivant |
| Alerte 80 % / 100 % / dépassement | Toast UI + notification (V2.1) |
| Édition de masse | Dupliquer un mois sur le suivant |

### 7.7 Mode famille (V2 / V3)

| Feature | Description |
|---|---|
| Création de famille | Le user devient `parent` automatiquement (trigger Postgres) |
| Invitation | Email → onboarding sans ré-inscription si user existant |
| Rôles | parent (full write), child (write own + read shared), viewer (read only) |
| Comptes partagés | `accounts.family_group_id` au lieu de `owner_user_id` |
| Vue qui-a-payé | `paid_by_user_id` sur chaque transaction, breakdown par membre |
| Realtime | Les autres membres voient les nouvelles transactions en live |
| Vote sur dépense (V3) | Pour les achats > seuil configurable, validation collective |
| Équilibrage charges (V3) | Calcul "qui doit combien à qui" sur les dépenses partagées |

### 7.8 Coaching IA (V2 — étape 4 archi)

| Feature | Description |
|---|---|
| Provider au choix | Anthropic, OpenAI, Mistral, Google, OpenRouter |
| Consentement explicite | Avant le 1er appel, formulaire qui horodate `ai_consents` |
| Anonymisation serveur | Edge Function strip noms / arrondit montants / généralise lieux |
| Pseudonyme par session | `ai_sessions.pseudonym_token` injecté à la place du nom |
| Historique consultable | `ai_session_messages` consultable, déjà anonymisé à l'écriture |
| Coupure RGPD | Révocation consentement → purge des sessions associées |

### 7.9 Scan reçus (V2 — étape 6 archi)

| Feature | Description |
|---|---|
| Photo via input file mobile | `<input type="file" accept="image/*" capture>` |
| Upload Supabase Storage | Bucket privé, RLS par owner |
| OCR via Edge Function + provider IA vision | Extraction montant, date, lieu |
| Pré-remplissage formulaire | User valide / corrige / sauvegarde |
| Lien transaction | `transactions.receipt_storage_path` |

### 7.10 Export PDF mensuel (V1.1)

| Feature | Description |
|---|---|
| 1 page par mois | Récap dépenses par catégorie, top 10 transactions, solde net, comparaison N-1 |
| jsPDF + jspdf-autotable | Pas de service serveur (génération client-side) |
| Téléchargement direct | Pas de stockage |

### 7.11 Notifications & rappels (V2)

| Feature | Description |
|---|---|
| Rappel saisie hebdo | Si pas d'opération depuis N jours |
| Alerte budget dépassé | À 80 / 100 / 120 % du plafond |
| Préalerte loyer / récurrence | J-3 avant l'échéance |
| Canal | Notif push web (Service Worker, V2 PWA), email opt-in |
| Configurable | Par user, par catégorie, opt-out global |

### 7.12 Mode hors-ligne (V3 — étape 7 archi)

| Feature | Description |
|---|---|
| PWA installable | Manifest + Service Worker |
| Cache assets | Stratégie cache-first sur le shell |
| File d'attente écritures | IndexedDB stocke les ops faites offline |
| Sync au retour réseau | Flush vers Supabase + résolution conflits (last-write-wins V3, CRDT futur) |
| Indicateur UI | Badge "hors ligne" / "synchronisation en cours" |

---

## 8. Catalogue d'écrans

### 8.1 Inventaire (cible V1.5 = 14 écrans)

| # | Écran | Fait | Composant React |
|---|---|---|---|
| 1 | Connexion | ✅ | `AuthScreen.tsx` |
| 2 | Inscription | ✅ | `AuthScreen.tsx` (mode signup) |
| 3 | Mot de passe oublié | ✅ | `AuthScreen.tsx` (mode forgot) |
| 4 | Onboarding 1er lancement | ✅ | inline App.tsx + `FirstTransactionTour.tsx` |
| 5 | Dashboard "Accueil" | ✅ | App.tsx `isActiveView('overview')` |
| 6 | Dashboard "Dépenses" | ✅ | App.tsx widgets pilotage |
| 7 | Dashboard "Budget" | ✅ | App.tsx `isActiveView('budget')` |
| 8 | Paramètres | ✅ partiel | App.tsx `isActiveView('settings')` |
| 9 | Saisie transaction (form) | ✅ | inline App.tsx |
| 10 | Historique transactions complet | ✅ | `TransactionHistoryPanel.tsx` |
| 11 | Gestion comptes | ✅ | `AccountsPanel.tsx` |
| 12 | Gestion dépenses récurrentes | ✅ | `RecurringRulesPanel.tsx` |
| 13 | Gestion objectifs d'épargne | ✅ | `SavingsGoalsPanel.tsx` |
| 14 | Profil utilisateur | ⏳ V1.5 | à créer (`ProfilePanel.tsx`) |
| 15 | Gestion famille (V2) | ⏳ V2 | à créer (`FamilyPanel.tsx`) |
| 16 | Notifications config (V2) | ⏳ V2 | à créer |
| 17 | Coaching IA chat (V2) | ⏳ V2 | à créer (`AiChatPanel.tsx`) |
| 18 | Scan reçu (V2) | ⏳ V2 | à créer (`ReceiptScanModal.tsx`) |

### 8.2 Wireframes textuels — écrans V1 livrés

#### Écran 1 — Connexion

```
┌──────────────────────────────────────┐
│ [LOGO PF]                            │
│                                      │
│ ┌─ (si Supabase non configuré) ─┐   │
│ │ ⚠ Configuration requise        │   │
│ │ Renseignez VITE_SUPABASE_URL… │   │
│ └────────────────────────────────┘   │
│                                      │
│ Connexion                            │
│ Accédez à votre tableau de bord.     │
│                                      │
│ [G  Continuer avec Google         ]  │
│ ────── ou ──────                     │
│                                      │
│ Email      [votre@email.com       ]  │
│ Mot passe  [••••••••              ]  │
│ [        Se connecter             ]  │
│                                      │
│ Mot de passe oublié ?                │
│ Pas encore de compte ? S'inscrire    │
│                                      │
│ Vos données sont chiffrées et        │
│ stockées localement sur cet appareil.│
└──────────────────────────────────────┘
```

#### Écran 9 — Saisie transaction

Formulaire principal en haut du dashboard "Dépenses" :
- Membre (select)
- Label (input + suggestion auto-catégorie via IA légère)
- Montant (input number)
- Type (depense / revenu)
- Catégorie (select, auto-déduit)
- Enveloppe (select, auto-déduit)
- Date (date picker)
- [Bouton Ajouter terre]

#### Écran 10 — Historique transactions complet

Modal pleine largeur :
- Header : titre + bouton fermer
- Stats : 4 cartes (Résultats / Revenus / Dépenses / Net) en grid 2×2 mobile, 4×1 desktop
- Search box pleine largeur
- 6 selects (Type / Catégorie / Enveloppe / Compte / Période / Tri) en grid auto-fill
- Bouton CSV pleine largeur
- Liste paginée des transactions avec dot couleur catégorie, label, meta (date · cat · env · compte), montant signé, actions (édit / suppr)
- Édition inline d'un row au clic crayon

#### Écran 11 — Gestion comptes

Modal :
- Bandeau solde consolidé en haut
- Form création/édition (nom, type, solde initial, couleur)
- Liste : pour chaque compte, dot couleur, nom, type, solde, actions (archiver, modifier, supprimer)

### 8.3 Parcours utilisateur — première utilisation

```
1. Arrivée sur l'app via URL
   → Écran Connexion (1)
2. Clic "S'inscrire"
   → Écran Inscription (2)
3. Saisie email + password (8+ chars confirmé)
   → Email confirmation Supabase
4. Confirmation email ouvert
   → Auto-login + redirection sur dashboard
5. Onboarding affiché (4) : choix "Avec IA" ou "Dashboard vide"
   → Si IA : choix provider + saisie clé API + chat configuration
   → Si vide : skip
6. Tour de première transaction (FirstTransactionTour)
   → Form pré-rempli "Boulangerie 8.50€"
   → User valide ou édite ou skip
7. Atterrissage sur Dashboard Accueil (5)
   → KPI summary, alertes, calendrier dépenses, objectifs
8. User clique "Dépenses" dans la nav
   → Dashboard Dépenses (6) : form de saisie + widgets multi-comptes / récurrences / historique / objectifs
```

---

## 9. APIs externes & intégrations

### 9.1 Supabase

| Service | Usage | Étape |
|---|---|---|
| Auth | Email/password + Google OAuth | ✅ Étape 1 |
| Postgres + RLS | Persistance transactions, comptes, etc. | ⏳ Étape 2+ |
| Realtime | Channels famille (live updates) | ⏳ Étape 3 |
| Storage | Bucket privé reçus | ⏳ Étape 6 |
| Edge Functions | Anonymisation IA, OCR vision, RGPD export | ⏳ Étape 4 + 6 |
| Cron (pg_cron) | Génération récurrences quotidienne | ⏳ Étape 5 |

**Endpoints utilisés (CSP whitelist)** :
- `https://*.supabase.co`
- `https://*.googleapis.com`, `https://identitytoolkit.googleapis.com` (OAuth Google relay via Supabase)
- `wss://*.supabase.co` pour Realtime

### 9.2 Providers IA

| Provider | Endpoint | État |
|---|---|---|
| Anthropic | `https://api.anthropic.com` | ✅ supporté |
| OpenAI | `https://api.openai.com` | UI prévue, edge-only en V2 |
| Mistral | `https://api.mistral.ai` | UI prévue, edge-only en V2 |
| Google | `https://generativelanguage.googleapis.com` | UI prévue, edge-only en V2 |
| OpenRouter | `https://openrouter.ai` | UI prévue, edge-only en V2 |

**V1** : la clé API est saisie par l'user et stockée en localStorage. Les appels partent du browser (user → provider directement, pas via serveur).
**V2 (étape 4)** : la clé migre dans Supabase secrets, les appels passent par Edge Function `/anonymize-and-forward`.

### 9.3 Pas d'API tierce externe en V1

- Pas de connecteur Open Banking (Bridge / Tink / Powens / Linxo Connect).
- Pas d'analytics (pas de Mixpanel / Amplitude / GA).
- Pas de Sentry — `AppErrorBoundary` capture localement, pas d'envoi externe.

---

## 10. Roadmap chiffrée

### 10.1 V1 (étapes 0 + 1 — ✅ livré au 2026-05-15)

| Sprint | Livrable | Effort dev solo |
|---|---|---|
| S0.1 | Décision archi + ERD + tokens charte + config Supabase | 1 sem |
| S0.2 | Pivot CSS vers la charte | 0.5 sem |
| S0.3 | Dépenses récurrentes V1 | 1 sem |
| S0.4 | Onboarding tour 1ère transaction | 0.5 sem |
| S0.5 | Multi-comptes V1 | 1.5 sem |
| S0.6 | Historique transactions V1 | 1 sem |
| S0.7 | Page objectifs V1 | 1 sem |
| S0.8 | Responsive 100 % audit | 0.5 sem |
| S1.1 | Migration Auth Firebase → Supabase | 1 sem |

**Total V1 ≈ 8 semaines** (livré en mode AI-assisted).

### 10.2 V1.5 (compléments avant V2) — ~3 semaines

| Sprint | Livrable | Effort |
|---|---|---|
| S1.5.1 | Sync transactions localStorage ↔ Supabase Postgres | 2 sem (étape 2 archi) |
| S1.5.2 | Page profil utilisateur (préférences, RGPD export local, suppression compte) | 1 sem |

### 10.3 V2 — ~10 semaines

| Sprint | Livrable | Effort |
|---|---|---|
| S2.1 | Mode famille : création groupe, invitation, rôles, comptes partagés | 2 sem |
| S2.2 | Realtime sync vue famille | 1 sem |
| S2.3 | Edge Function anonymisation IA + migration clé API serveur | 1 sem |
| S2.4 | Cron récurrences serveur + budgets par catégorie/mois | 2 sem |
| S2.5 | Notifications & rappels (web push, email) | 1.5 sem |
| S2.6 | Export PDF mensuel | 0.5 sem |
| S2.7 | Scan reçus IA (OCR via vision provider) | 2 sem |

### 10.4 V3 — ~6 semaines

| Sprint | Livrable | Effort |
|---|---|---|
| S3.1 | PWA + offline-first (Service Worker, IndexedDB queue) | 2 sem |
| S3.2 | Vue famille avancée : équilibrage charges, vote dépense partagée | 2 sem |
| S3.3 | Widget écran d'accueil (PWA shortcuts) | 1 sem |
| S3.4 | Bilan annuel généré par IA (récap fin d'année) | 1 sem |

### 10.5 Budget temps total post-V1

≈ **19 semaines = 4.5 mois plein-temps** OU **~7 mois mi-temps**.

### 10.6 Coût d'infra mensuel estimé

| Phase | Hosting | Coût |
|---|---|---|
| V1 (≤ 500 users) | Supabase free tier (50k MAU, 500 MB DB) | 0 € |
| V2 (500–5k users) | Supabase Pro ($25) + bande passante | ~30 € |
| V3 (5k–50k users) | Supabase Pro + add-on storage + edge invocations | 80–150 € |

---

## 11. Critères d'acceptation V1

### 11.1 Fonctionnel

- [ ] Un user peut s'inscrire, se connecter, se déconnecter, réinitialiser son mot de passe.
- [ ] Un user peut créer / éditer / archiver / supprimer un compte (sauf si transactions liées).
- [ ] Un user peut saisir / éditer / supprimer une transaction et l'attribuer à un compte.
- [ ] Un user peut créer une règle récurrente et voir les transactions générées automatiquement à l'échéance.
- [ ] Un user peut créer un objectif d'épargne avec date cible et voir la mensualité conseillée.
- [ ] Un user peut chercher / filtrer / trier / exporter en CSV son historique complet.
- [ ] Le solde consolidé (multi-comptes) est correct au centime près.
- [ ] Le PIN parent est demandé après expiration de session (7/14/30 jours configurables).

### 11.2 Non-fonctionnel

- [ ] Toute page se charge en < 2 s sur 4G (lighthouse mobile).
- [ ] L'app est utilisable à 320 px (iPhone SE) sans débordement horizontal.
- [ ] Score Lighthouse Accessibility ≥ 95.
- [ ] Aucune erreur console au runtime.
- [ ] Build TypeScript strict passe sans erreur.
- [ ] Tests unitaires Vitest passent (≥ 100 tests).
- [ ] CSP empêche l'exécution de scripts non whitelistés.

### 11.3 Sécurité / RGPD

- [ ] Le PIN parent n'est jamais persisté en clair (uniquement hash PBKDF2).
- [ ] Aucune donnée métier ne quitte l'appareil avant que l'user soit authentifié sur Supabase.
- [ ] Tous les appels Supabase passent par RLS (jamais le service_role côté client).
- [ ] La clé API IA n'est pas commitée dans le bundle.
- [ ] L'export RGPD permet à l'user de récupérer ses données en JSON.
- [ ] La suppression compte purge toutes les tables liées (cascade Postgres).

---

## 12. Annexes & glossaire

### 12.1 Glossaire métier

| Terme | Définition |
|---|---|
| **Compte** | Compte bancaire ou enveloppe budgétaire (table `accounts`). Un user a 1..N comptes. |
| **Enveloppe** | Sous-bucket d'un compte ("Perso", "Maison", "Vacances") — pour le pilotage budgétaire mental. |
| **Transaction** | Mouvement d'argent (dépense ou revenu) attaché à un compte. |
| **Catégorie** | Étiquette sémantique d'une transaction (Courses, Transport, etc.). |
| **Récurrence** | Règle qui génère des transactions automatiquement (ex. loyer mensuel). |
| **Objectif** | Cible d'épargne avec montant + date optionnelle. |
| **Profil** | Membre du foyer — V1 : 1 user = 1 profil. V2 : N profils dans une famille. |
| **PIN parent** | Code 4–6 chiffres local, indépendant de l'auth Supabase, protège l'accès à un appareil partagé. |

### 12.2 Glossaire technique

| Terme | Définition |
|---|---|
| **RLS** | Row-Level Security : règles d'accès Postgres au niveau de la ligne (par user). |
| **Edge Function** | Fonction Deno serverless hébergée par Supabase, proche du client (latence faible). |
| **Anon key** | Clé publique Supabase pour `authenticated` rôle — exposable au client, sécurisée par RLS. |
| **Service role key** | Clé Supabase **secrète**, bypass RLS — réservée Edge Functions, jamais commitée. |
| **CSP** | Content Security Policy : meta tag qui restreint les sources de scripts/styles autorisées. |
| **PBKDF2** | Algorithme de dérivation de clé (200k itérations + sel) utilisé pour hasher le PIN parent. |

### 12.3 Références internes

- [docs/architecture.md](architecture.md) — décision archi détaillée + plan migration en 7 étapes.
- [supabase/migrations/0001_initial_schema.sql](../supabase/migrations/0001_initial_schema.sql) — DDL Postgres + RLS exhaustive.
- [supabase/config.toml](../supabase/config.toml) — config Supabase locale (CLI).
- [src/styles/tokens.css](../src/styles/tokens.css) — tokens charte CSS.
- [brand_identity_plan_financier.html](../brand_identity_plan_financier.html) — charte source.
- [README.md](../README.md) — setup & scripts.
- [CLAUDE.md](../CLAUDE.md) — règles projet (collaborateur IA).

### 12.4 Hors-scope explicites V1 / V2

| Hors scope | Raison |
|---|---|
| Connecteur Open Banking | Coût + dépendance + faille du marché (panne fréquente Bridge/Tink) |
| App native iOS/Android | PWA suffisante, on garde 1 codebase |
| Conseil financier régulé (AMF) | Hors compétence, hors agrément |
| Multi-devise | UI EUR-only, le `currency` SQL existe pour le futur |
| Crypto | V3 minimum, via `accounts.type = 'investment'` |
| Marketplace de produits financiers (assurances, crédit) | Pas le positionnement |

### 12.5 Risques projet identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Coût Supabase dépasse free tier rapidement | Moyen | Modélisation à 100/500/1k MAU avant lancement, alertes facturation |
| Saisie manuelle = friction → faible rétention | Élevé | Investir tôt dans : scan reçus, récurrences, IA catégorisation. KPI activation surveillé |
| Mode famille = complexité énorme (RLS, partage, notifs) | Élevé | Sortir en V2 avec scope minimal (parent/viewer), enrichir en V3 |
| Lock-in Supabase si pivot serveur | Faible | Postgres standard, `pg_dump` portable. Edge Functions Deno = standard W3C |
| Compatibilité iOS Safari (WebKit) | Moyen | Tester systématiquement à chaque release sur iPhone réel |
| Conformité RGPD incomplète | Élevé (légal) | DPA Supabase signé, doc de privacy publiée, export + suppression effectifs avant lancement public |

---

**Fin du cahier des charges.**

> Ce document est versionné dans le repo. Toute évolution du périmètre doit donner lieu à un commit qui modifie ce fichier (`docs/cahier-des-charges.md`) et incrémente la version dans l'en-tête.
