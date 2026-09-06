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

---

## Correctifs du 6 septembre

### Compte neuf vraiment vide
Symptôme : un compte fraîchement créé affichait déjà un budget et des
opérations.

Trois causes, trois corrections :
1. **Jeu d'opérations de démonstration codé en dur** (`baseTransactions`,
   « Supermarché hebdo » etc.) chargé quand le stockage local était vide →
   supprimé. Un compte neuf n'a aucune opération.
2. **Budget par défaut 2 300 €** et **plafonds par catégorie pré-remplis**
   (Courses 320 €…) → tout à 0 = « à définir ». Le hero de l'accueil affiche
   alors « Dépensé ce mois » + lien « Définissez votre budget mensuel »
   (ouvre Paramètres → Profils) au lieu d'un reste à dépenser négatif.
3. **Données locales partagées entre comptes** : les clés localStorage
   étaient globales à l'appareil ; un second compte héritait des données du
   premier, et la synchro cloud les poussait dans le nouveau compte.
   → `src/lib/localWorkspace.ts` : à chaque connexion, si l'identifiant du
   compte change, l'espace du compte précédent est mis de côté (instantané
   sous sa clé), les clés de données sont vidées, l'espace du nouveau compte
   est restauré s'il existe, puis l'app se recharge **avant** la synchro
   cloud. Thème, palette, accessibilité et PIN parent restent propres à
   l'appareil.

> Première connexion après déploiement : les données déjà présentes sur
> l'appareil sont attribuées au compte qui se connecte en premier. Se
> connecter d'abord avec le compte principal sur chaque appareil, puis créer
> les comptes de test.

Bonus : la démo n'écrit plus les objectifs d'épargne dans le stockage local
(le versement rapide et le panneau passent par `commitSavingsTargets`, gardé
par `demoMode`).

### PWA installée : app seule, sans vitrine
- `Bootstrap` ouvre directement l'app (connexion ou tableau de bord) en mode
  installé ; le manifeste démarre sur `/app`.
- Écran de connexion sans « ← Retour au site » ; la déconnexion ramène à la
  connexion, pas à la vitrine.

### Emails : logo + expéditeur
- Logo `https://planfinancier.app/logo.png` dans les emails des fonctions
  (bienvenue, relance, rapports, digest erreurs) et dans les templates
  Supabase Auth (`docs/supabase-email-templates.md`, à recoller).
- Expéditeur par défaut du code : `Plan Financier <contact@protojo.fr>`.
- Marche à suivre dashboards (domaine Resend, secret `REPORT_FROM`, SMTP
  Supabase Auth) : [docs/emails-expediteur.md](emails-expediteur.md).
