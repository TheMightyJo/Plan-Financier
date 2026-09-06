/** Étape du tour guidé : élément `data-tour` à mettre en lumière + texte. */
export type TourStep = {
  /** Valeur de l'attribut data-tour à mettre en lumière ; null = bulle centrée. */
  target: string | null
  title: string
  text: string
  /** Section à afficher avant de chercher la cible (ex. 'overview'). */
  section?: string
}

/** Étapes du tour de découverte (ordre = parcours dans l'app). */
export const FEATURE_TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Bienvenue dans Plan Financier 👋',
    text: 'Une minute pour découvrir les fonctionnalités principales. Vous pouvez passer ce tour à tout moment et le relancer depuis les Paramètres.',
    section: 'overview',
  },
  {
    target: 'hero',
    title: 'Votre reste à dépenser',
    text: "L'accueil vous dit ce qu'il vous reste ce mois-ci, combien ça représente par jour, et la météo de votre semaine.",
    section: 'overview',
  },
  {
    target: 'quick-add',
    title: 'Ajouter en 3 secondes',
    text: 'Une dépense ou un revenu : montant, libellé, catégorie. Les commerçants connus reçoivent leur logo automatiquement.',
  },
  {
    target: 'nav-operations',
    title: 'Dépenses et calendrier',
    text: 'Toutes vos opérations, par jour ou en liste, avec vos charges fixes qui apparaissent avant de tomber.',
  },
  {
    target: 'nav-budget',
    title: 'Budget : poches et objectifs',
    text: 'Répartissez votre argent en poches (Courses, Sorties, Imprévus…) et suivez vos projets d’épargne, avec un rythme et une date estimée.',
  },
  {
    target: 'nav-stats',
    title: 'Statistiques semaine par semaine',
    text: 'Chaque semaine reçoit un statut simple : Équilibrée, En progrès, Record ou À surveiller. Un bilan arrive aussi par email si vous le souhaitez.',
  },
  {
    target: 'cash',
    title: 'Cash, votre assistant',
    text: '« Où part mon argent ce mois-ci ? » Posez vos questions en français : Cash répond à partir de vos données, sans jamais les partager.',
  },
  {
    target: 'settings',
    title: 'Paramètres',
    text: 'Profils de la famille, rapport par email, notifications, installation sur votre téléphone et vos données (export, suppression).',
  },
]
