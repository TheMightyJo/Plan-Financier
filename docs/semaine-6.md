# Semaine 6 — produit : récurrences détectées, import CSV visible, installer l'app

Aucune action côté Supabase cette semaine : tout est dans l'app.

## Récurrences détectées (Accueil)

`src/lib/recurringDetection.ts` (6 tests) repère les opérations qui reviennent
chaque mois sans être programmées : même libellé (chiffres ignorés), montant
à ±12 %, jour du mois à ±4, au moins deux mois consécutifs. Les libellés déjà
programmés, générés par une règle, ou rejetés (« Non ») sont exclus.

Sur l'Accueil, une fois les Premiers pas terminés ou masqués, la carte
« 🔁 Ça revient chaque mois — on le programme ? » propose jusqu'à 3
opérations (les plus grosses d'abord). « Programmer » crée la règle
mensuelle ; la génération démarre le mois suivant la dernière occurrence.

## Import de relevé bancaire

Sous les Premiers pas : « Vous avez un relevé bancaire ? Importez-le en
CSV » → ouvre Dépenses, rend le widget d'import visible s'il était masqué,
et fait défiler jusqu'à lui.

## Installer l'app (PWA)

- `src/lib/pwaInstall.ts` capte `beforeinstallprompt` dès le démarrage.
- Paramètres → 📲 Installer l'app : bouton natif (Chrome/Edge/Android),
  sinon les étapes iPhone (Safari → Partager → Sur l'écran d'accueil) ou
  navigateur de bureau. Un bouton 📲 apparaît aussi dans le menu quand
  l'invite native est disponible.
