# Semaine 12 — Catégories personnalisables

Le catalogue proposait déjà une quarantaine de catégories groupées, mais
seule la modale d'ajout rapide l'exposait ; le formulaire principal, l'édition
dans l'historique et les règles récurrentes restaient sur 7 catégories, et
rien n'était personnalisable.

## Ce qui change
- **Paramètres → Catégories** (`CategoriesPanel`) : créer une catégorie
  (nom, dépense/revenu, icône emoji, couleur, famille du catalogue ou « Mes
  catégories »), la modifier, la renommer (les opérations, règles et plafonds
  suivent), l'archiver (masquée des listes, données conservées) ou la
  supprimer (seulement si inutilisée). Saisir le nom d'une catégorie du
  catalogue (ex : Courses) personnalise seulement son icône et sa couleur.
- **Partout le même catalogue** : formulaire principal, ajout rapide,
  historique (filtre et édition) et règles récurrentes utilisent le catalogue
  groupé + catégories personnalisées. Une valeur historique absente du
  catalogue reste affichée.
- **Plafonds par catégorie** : les catégories de dépense personnalisées
  apparaissent dans « Budgets par catégorie ».
- **Cash** : la classification automatique propose et accepte aussi les
  catégories personnalisées.
- **Pastilles et emoji** : `registerCategoryOverrides` (lib/categories) fait
  que `colorForCategory` / `categoryEmoji` respectent les surcharges sans
  changer les dizaines d'appels existants.
- **Synchro** : nouvelle clé `plan-financier-custom-categories-v1`, suivie par
  la synchro documents (semaine 10) et l'espace local par compte.

## Sous-catégories
Les « familles » du catalogue (Logement, Transport, Enfants & école…) jouent
ce rôle : une catégorie personnalisée se range dans la famille de son choix
et apparaît sous ce groupe dans les sélecteurs.

## Fichiers
- `src/lib/customCategories.ts` (+8 tests) : normalisation, catalogue
  fusionné, validation, surcharges, usage, migrations de renommage
- `src/components/CategoriesPanel.tsx`
- `src/lib/categories.ts` (registre de surcharges), `QuickAddModal`,
  `TransactionHistoryPanel`, `RecurringRulesPanel` (groupes injectés)
- `src/App.tsx` (état, persistance, sélecteur groupé du formulaire principal,
  plafonds, IA, section Paramètres, renommage)
- `src/lib/documentSync.ts`, `src/lib/localWorkspace.ts`

## Aussi dans cette livraison
- Vue Dépenses : le rail de droite est découpé en cartes séparées (Cash,
  À venir, Plus grosses dépenses, Tags).
