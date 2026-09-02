# Blog SEO — comment ajouter un article

Le blog est **statique** : chaque article est un fichier Markdown dans
`content/blog/`, transformé en page HTML pure par `scripts/build-blog.mjs`
au moment du `npm run build` (donc à chaque déploiement). Les pages sont
indexables sans JavaScript, avec balises SEO, données structurées
(BlogPosting), sitemap et robots.txt générés automatiquement.

## Ajouter un article

1. Créer `content/blog/mon-slug.md` (le nom du fichier = l'URL :
   `https://planfinancier.app/blog/mon-slug/`). Slug en minuscules,
   sans accent, mots séparés par des tirets.
2. Commencer par l'en-tête :

```md
---
title: "Titre de l'article (60 à 70 caractères, mot-clé au début)"
description: "Résumé de 140 à 160 caractères — c'est le texte affiché par Google."
date: "2026-09-15"
---
```

3. Écrire le corps en Markdown simple : `##` pour les sections, `###`
   pour les sous-sections, listes `-` ou `1.`, citation `>`, gras `**`,
   liens `[texte](/blog/autre-article/)`.
4. Ajouter un lien vers l'app (`/`, `/demo`) et vers 1 ou 2 autres
   articles (maillage interne — Google adore).
5. `npm run build` puis « pousse et merge » : l'article est en ligne, dans
   la liste `/blog/` et dans `sitemap.xml`.

## Conseils SEO rapides

- Un article = **une** intention de recherche (« comment faire un budget
  familial », « méthode des enveloppes »…).
- 700 à 1 200 mots, sections courtes, une réponse concrète dès le début.
- Pas de contenu dupliqué entre articles ; chaque page a sa `description`.
- Après le déploiement : soumettre `https://planfinancier.app/sitemap.xml`
  dans la Google Search Console (une fois suffit, elle relit ensuite).
