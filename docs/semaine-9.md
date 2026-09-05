# Semaine 9 — Objectifs d'épargne v2

Objectif : rendre les projets d'épargne **actionnables** depuis l'accueil et
montrer à l'utilisateur s'il est dans les temps, sans connexion bancaire.

## Ce qui change

### Versements « Mettre de côté »
- Chaque objectif garde un historique de versements (`contributions`, champ
  optionnel → rétro‑compatible avec les objectifs existants et la synchro).
- Sans compte lié : le versement augmente `currentSaved` (jamais sous 0).
- Avec compte lié : le solde du compte reste la référence ; le versement sert
  uniquement à calculer le rythme.
- Entrée rapide depuis la carte KPI de l'accueil (`+ Mettre de côté` → montant
  → OK) et depuis le panneau des objectifs (bouton par objectif, 3 derniers
  versements affichés).

### Rythme et projection
- `monthlyPace` : versements des 90 derniers jours ramenés au mois (plancher
  1 mois, fenêtre qui démarre au premier versement observé).
- `projectedCompletionDate` : date d'atteinte au rythme observé.
- `computePaceOutlook` : synthèse (rythme, date projetée, écart en mois vs
  échéance : négatif = avance, positif = retard).
- Affichage : « Rythme 120 €/mois · atteint vers mars 2027 (2 mois d'avance) »
  dans le panneau ; « À ce rythme : 2 mois d'avance / de retard / atteint vers… »
  sur la carte KPI.

### Carte KPI accueil
- Progression via `computeCurrentSaved` (compte lié ou montant manuel) au lieu
  du seul `currentSaved`.
- « Reste X € · ≈ Y €/mois » (mensualité conseillée si échéance).
- Lien « Gérer les objectifs » : le panneau est désormais accessible même
  quand le widget « Projets d'épargne » n'est pas activé dans Budget.

### Cash (IA)
- Le contexte envoyé au modèle inclut le projet principal (épargné / cible,
  échéance, mensualité conseillée, rythme observé) pour des conseils ancrés.

## Fichiers
- `src/types.ts` — `SavingsContribution`, `SavingsTarget.contributions`.
- `src/lib/savingsGoals.ts` — `addContribution`, `monthlyPace`,
  `projectedCompletionDate`, `computePaceOutlook` (+ 12 tests).
- `src/lib/format.ts` — `formatMonthYear`.
- `src/components/SavingsGoalsPanel.tsx` — versement inline, rythme, historique.
- `src/App.tsx` — carte KPI (reste, mensualité, rythme, versement rapide,
  lien Gérer), prompt Cash, `commitSavingsTargets`.
- `src/index.css` — styles `.kpi-goal-*`, `.goal-outlook`, `.goal-contributions`,
  `.goal-contribute-*`.

## Vérifications
- `npm run build`, `vitest` (199 tests), ESLint sur les fichiers touchés.
- E2E Playwright (vitrine, démo, blog) : 11 passés, 1 ignoré (habituel).
- Smoke démo : versement 150 € depuis l'accueil (48 % → 53 %, historique
  stocké dans `plan-financier-savings-targets-v1`), versement 50 € depuis le
  panneau, ligne « À ce rythme » et « Gérer les objectifs » OK.

## Rien à faire côté Supabase
Les versements vivent dans l'objet objectif déjà synchronisé (localStorage) ;
aucune migration nécessaire.
