# Plan Financier

Cockpit budgétaire familial : suivi des dépenses, enveloppes, objectifs d'épargne, import CSV bancaire, projections et coaching IA.

Application 100 % côté navigateur — les données métier restent sur l'appareil (localStorage) et l'authentification passe par Supabase (région EU).

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Supabase Auth** (email/password + Google OAuth) — hosting EU, RGPD-friendly
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
├── supabase.ts            # Client Supabase + garde-fou env vars
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
- **Supabase** : seules les API d'authentification sont actives en V1 (la migration des données vers Postgres + RLS est en cours, cf. plan d'archi étape 2+). La clé publique côté client (`VITE_SUPABASE_ANON_KEY`) est conçue pour être exposée — la défense repose sur la **Row-Level Security** côté serveur.
- **CSP** : politique restrictive déclarée dans `index.html` pour limiter la surface XSS.

## Configuration Supabase (REQUISE pour l'auth)

Sans configuration Supabase, l'écran de connexion affiche un bandeau d'avertissement et les boutons d'auth lèvent une erreur claire — l'app reste utilisable techniquement mais aucun login n'est possible.

### Setup en 5 étapes

1. **Installer le CLI Supabase** (macOS) :

   ```bash
   brew install supabase/tap/supabase
   ```

2. **Créer un projet Supabase** : https://supabase.com → New project, region **Frankfurt** (EU, RGPD).

3. **Récupérer les credentials** : Project Settings → API. Copier dans `.env.local` :

   ```bash
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon-key-publique>
   ```

4. **Appliquer le schéma** (14 tables + RLS + seed catégories) :

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

5. **(Optionnel) Activer Google OAuth** : Authentication → Providers → Google. Configurer client_id/secret depuis Google Cloud Console.

### Migration depuis Firebase (utilisateurs existants)

Les comptes Firebase ne sont **pas migrés automatiquement** vers Supabase. Les utilisateurs existants doivent :
- Cliquer "Pas encore de compte ? S'inscrire" pour créer un compte Supabase avec le même email.
- OU recevoir un email "réinitialisez votre mot de passe" pour les comptes pré-importés via `supabase admin`.

Les **données métier** (transactions, comptes, objectifs, règles récurrentes) sont en localStorage : aucune migration nécessaire à l'étape 1, elles restent disponibles localement.

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
