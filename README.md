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
├── firebase.ts            # Initialisation Firebase
├── security.ts            # PIN parent + chiffrement local
├── types.ts               # Types métier partagés
├── lib/                   # Helpers purs (formatage, dates, calculs)
└── index.css              # Styles globaux
```

## Sécurité

- **PIN parent** : haché côté client (PBKDF2 + sel par installation, AES-GCM) avant d'être stocké. Le PIN en clair n'est jamais persisté.
- **Données financières** : conservées dans `localStorage` du navigateur (non synchronisées). Seul l'utilisateur du poste y a accès.
- **Firebase** : seules les API d'authentification sont utilisées. La configuration côté client est publique (clé identifiant le projet, pas un secret) — la défense repose sur les règles Auth/Firestore.
- **CSP** : politique restrictive déclarée dans `index.html` pour limiter la surface XSS.

## Configuration Firebase

Les paramètres du projet sont déclarés dans [`src/firebase.ts`](src/firebase.ts). Pour pointer vers un autre projet Firebase, modifier directement ce fichier.

Les fichiers `firebase.json`, `firestore.rules` et `storage.rules` à la racine définissent la configuration de déploiement et les règles de sécurité par défaut (deny-all tant que Firestore/Storage ne sont pas utilisés).

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
