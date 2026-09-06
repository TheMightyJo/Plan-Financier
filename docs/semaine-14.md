# Semaine 14 — Dette technique

## Découpage d'App.tsx
App.tsx passe de **9 229 à 8 442 lignes** (−787) sans changement de
comportement : sept sections des Paramètres deviennent des composants dans
`src/components/settings/`, avec des props nommées comme les variables
d'App (le JSX est repris tel quel, TypeScript vérifie la surface).

| Composant | Section |
|---|---|
| `ProfilesSettings` | Profils (liste, éditeur, invitations famille) |
| `SubscriptionSettings` | Abonnement |
| `ReportSettings` | Rapport par email |
| `AiSettings` | Assistant IA |
| `BackupSettings` | Sauvegarde (état cloud, export / restauration) |
| `ThemeSettings` | Thème et palette |
| `A11ySettings` | Accessibilité |

Modules partagés créés au passage : `lib/appearance.ts` (préférences
d'accessibilité, palettes) et `components/InfoHint.tsx`.

Méthode (réutilisable pour la suite) : extraire le bloc `{settingsSection ===
'x' ? (…) : null}`, le coller dans un composant dont les props portent les
mêmes noms, remplacer le bloc par `<XSettings a={a} b={b} />`, laisser `tsc`
lister les noms manquants. Chaque extraction est vérifiée par build, tests
unitaires, E2E et ouverture de la section en démo.

Prochains candidats, par taille : la vue Dépenses (~450 lignes, ~45 props),
la section « pilotage » de Budget (~1 000 lignes), puis l'Accueil.

## Tests E2E connectés
`e2e/connected.e2e.ts` : connexion avec un compte de test, ajout d'une
opération, rechargement, vérification de la persistance, suppression,
déconnexion. **Ignoré** sans `E2E_EMAIL` / `E2E_PASSWORD` (donc en CI tant que
les secrets ne sont pas posés). Marche à suivre dans `docs/tests-e2e.md`.

## Vérifications
- build, tsc, 252 tests unitaires, E2E 15 passés / 5 ignorés (4 connectés + 1
  habituel), chaque section extraite ouverte en démo.
- Erreurs ESLint dans App.tsx : 60 → 56 (déplacées avec le code, aucune
  nouvelle).
