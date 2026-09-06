# Semaine 11 — Prévision de fin de mois

L'accueil disait ce qu'il reste aujourd'hui ; il dit maintenant ce qu'il
restera le 30, et prévient quand ça va passer sous zéro.

## Calcul (`src/lib/forecast.ts`, pur, 11 tests)
- Point de départ : le reste à dépenser du jour (budget + report − dépenses
  du mois). Mois courant et budget défini uniquement.
- Charges fixes à venir : occurrences des règles récurrentes actives du
  profil jusqu'à la fin du mois, hors occurrences déjà saisies
  (`recurringRuleId` + date). Revenus récurrents ajoutés de la même façon.
- Dépenses courantes : rythme quotidien des dépenses hors récurrent sur les
  28 derniers jours, en écartant les dépenses isolées supérieures à 20 % du
  budget (loyer saisi à la main, achat exceptionnel). Historique court :
  division par les jours couverts, plancher 14 jours pour ne pas extrapoler.
- Projection jour par jour → solde de fin de mois, premier jour négatif,
  statut : `ok` / `tight` (moins de 3 jours de marge) / `negative`.

## Affichage
- **Hero** : ligne colorée « Fin de mois prévue : +436 € », « Fin de mois
  serrée » ou « ⚠️ Découvert probable le 23 septembre · fin de mois −85 € ».
- **Carte « Fin de mois prévue »** sur l'accueil (`ForecastCard`) : courbe du
  solde projeté (SVG inline, points sur les charges à venir), trois chiffres
  (charges fixes, revenus, dépenses courantes estimées), 5 prochaines
  charges, ligne de méthode. Sans règle récurrente : lien vers le
  gestionnaire de charges.
- **Alertes** : découvert probable (danger) ou fin de mois serrée (warning).
- **Cash** : la prévision est dans le contexte envoyé au modèle.

## Limites connues
- Pas de projection sur un autre mois que le mois courant.
- Le rythme ignore la saisonnalité (Noël, rentrée). Piste : pondérer par le
  même mois de l'année précédente quand l'historique existe.
- Pas encore d'email « votre fin de mois » : les règles récurrentes sont
  désormais dans `user_documents`, une fonction Edge pourrait les lire.
