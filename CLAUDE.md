# CLAUDE.md

## Contexte du projet

Application web de planification financière en React + TypeScript + Vite.
Le projet utilise Firebase pour l’authentification, Recharts pour les graphiques, Lucide pour les icônes et jsPDF pour les exports.

Les points d’entrée et fichiers sensibles à connaître sont :
- [src/App.tsx](src/App.tsx) pour l’interface principale et la logique de l’application.
- [src/AuthScreen.tsx](src/AuthScreen.tsx) pour l’écran d’authentification.
- [src/firebase.ts](src/firebase.ts) pour l’initialisation Firebase.
- [src/security.ts](src/security.ts) pour le stockage local chiffré et les données sensibles.

## Règles de travail

1. Faire des changements ciblés et minimaux, centrés sur la demande utilisateur.
2. Éviter les refactors larges non demandés.
3. Préserver les comportements existants de navigation, d’authentification et de persistance locale.
4. Ne jamais exposer de secrets dans les logs, les erreurs ou les réponses.
5. Conserver les patterns déjà en place pour Firebase, localStorage et la gestion d’état.
6. Quand une modification touche la sécurité ou les données sensibles, vérifier d’abord le flux existant dans [src/security.ts](src/security.ts).

## Conventions techniques

- Respecter TypeScript strict et le style du code existant.
- Favoriser les composants et helpers déjà présents avant d’en créer de nouveaux.
- Garder la logique métier hors des composants quand une extraction simple vers un helper est possible.
- Ne pas modifier les clés de stockage local ni les contrats de données sans nécessité claire.
- Éviter d’introduire des dépendances supplémentaires si une solution existe déjà dans le projet.

## Vérifications attendues

Avant de considérer une tâche comme terminée :

1. Lancer `npm run lint` sur les fichiers concernés si c’est pertinent.
2. Lancer `npm run build` si la modification touche le code applicatif.
3. Vérifier qu’aucune régression visuelle ou fonctionnelle évidente n’a été introduite.
4. Si l’authentification, la persistance ou le chiffrement local sont touchés, valider le flux complet associé.

## Format de réponse conseillé

Répondre brièvement avec :
- ce qui a changé,
- pourquoi c’est correct,
- les fichiers impactés,
- les vérifications effectuées.