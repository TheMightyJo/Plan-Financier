# Tests de bout en bout (Playwright)

Trois parcours clés, joués sur le **build de production** (`vite preview`,
donc blog statique et sitemap compris), en desktop et en mobile (iPhone 13
émulé) :

- `e2e/landing.e2e.ts` — vitrine → connexion → retour, liens de nav ;
- `e2e/demo.e2e.ts` — démo : données présentes, premiers pas, ajout d'une
  dépense retrouvée dans Dépenses, barre d'onglets fixe en mobile,
  garde-fou démo (toast) ;
- `e2e/blog.e2e.ts` — liste et article (h1, canonical, JSON-LD), sitemap,
  robots.

## Lancer

```bash
npm run test:e2e
```

Première fois sur une machine : `npx playwright install chromium`.
En cas d'échec, une capture et une trace sont déposées dans
`test-results/` (`npx playwright show-trace <trace.zip>`).

## Pourquoi sur le build

Les tests ont trouvé dès leur premier passage un bug invisible en dev :
le minifieur CSS supprimait `backdrop-filter: none`, et sur Chrome Android
la barre d'onglets mobile se retrouvait collée dans l'en-tête au lieu du
bas de l'écran. Tester le build, pas le serveur de dev.
