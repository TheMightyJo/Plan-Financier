# Plan Financier

Cockpit budgétaire familial : suivi des dépenses, enveloppes, objectifs d'épargne, import CSV bancaire, projections et coaching IA.

Application 100 % côté navigateur — les données restent sur l'appareil (localStorage) et seule l'authentification passe par Firebase.

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Firebase Auth** (email/password + Google)
- **Recharts** pour les graphiques, **Lucide React** pour les icônes
- **jsPDF** + **jspdf-autotable** pour les exports
- **Vitest** pour les tests

## Démarrage

```bash
npm install
npm run dev
```

L'application est servie sur http://localhost:5173.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de dev avec HMR |
| `npm run build` | Type-check (`tsc -b`) puis build Vite |
| `npm run lint` | ESLint sur tout le projet |
| `npm run test` | Lance Vitest une fois |
| `npm run test:watch` | Vitest en watch |
| `npm run preview` | Sert le build de production localement |

## Structure

```
src/
├── App.tsx                # Application principale
├── AppErrorBoundary.tsx   # Boundary d'erreur global
├── AuthScreen.tsx         # Écran d'authentification
├── firebase.ts            # Initialisation Firebase (à supprimer en étape 1)
├── security.ts            # PIN parent + chiffrement local
├── types.ts               # Types métier partagés
├── lib/                   # Helpers purs (formatage, dates, calculs)
├── styles/
│   └── tokens.css         # Tokens charte (palette terre/crème, typo, radius)
└── index.css              # Styles globaux

docs/
└── architecture.md        # Décision archi cible (Supabase) + ERD + plan migration

supabase/
├── config.toml            # Config Supabase locale (CLI)
└── migrations/
    └── 0001_initial_schema.sql   # Schéma Postgres + RLS + seed catégories
```

## Sécurité

- **PIN parent** : haché côté client (PBKDF2 + sel par installation, AES-GCM) avant d'être stocké. Le PIN en clair n'est jamais persisté.
- **Données financières** : conservées dans `localStorage` du navigateur (non synchronisées). Seul l'utilisateur du poste y a accès.
- **Firebase** : seules les API d'authentification sont utilisées. La configuration côté client est publique (clé identifiant le projet, pas un secret) — la défense repose sur les règles Auth/Firestore.
- **CSP** : politique restrictive déclarée dans `index.html` pour limiter la surface XSS.

## Configuration Firebase (transitoire)

Les paramètres du projet sont déclarés dans [`src/firebase.ts`](src/firebase.ts). Firebase Auth est utilisé jusqu'à l'étape 1 du [plan d'architecture](docs/architecture.md), où il sera remplacé par Supabase Auth.

Les fichiers `firebase.json`, `firestore.rules` et `storage.rules` à la racine définissent la configuration de déploiement et les règles de sécurité par défaut (deny-all tant que Firestore/Storage ne sont pas utilisés).

## Préparation Supabase (étape 0 ✅, étape 1 à venir)

Le projet est en cours de migration vers Supabase (cf. [docs/architecture.md](docs/architecture.md) — décision validée le 2026-05-14).

### Ce qui est prêt dès aujourd'hui

- `supabase/migrations/0001_initial_schema.sql` — schéma Postgres complet (14 tables), RLS exhaustive, catégories système en seed.
- `supabase/config.toml` — config Supabase locale (PostgREST, Realtime, Studio, Storage, Auth).
- `.env.example` — variables attendues côté client (`VITE_SUPABASE_*`) et serveur (`SUPABASE_SERVICE_ROLE_KEY`).
- `src/styles/tokens.css` — tokens design importés globalement, prêts à être consommés via `var(--pf-*)`.

### Pour démarrer l'étape 1 (migration auth)

1. Installer le CLI Supabase :

   ```bash
   brew install supabase/tap/supabase
   ```

2. Créer un projet Supabase EU (https://supabase.com → New project, region "Frankfurt").
3. Récupérer `URL` et `anon key` dans Project Settings → API, les coller dans `.env.local`.
4. Appliquer le schéma :

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

5. Installer le SDK côté client : `npm install @supabase/supabase-js`.
6. Suivre le plan de migration dans [docs/architecture.md](docs/architecture.md) §6.

## Conventions

- TypeScript en mode `strict`.
- Composants UI dans `src/`, helpers purs dans `src/lib/` (testables sans React).
- Clés de stockage local préfixées par `plan-financier-` et versionnées (`-v1`, etc.).
- Tests Vitest co-localisés (`fichier.test.ts`).

## Vérifications avant commit

```bash
npm run lint
npm run test
npm run build
```
