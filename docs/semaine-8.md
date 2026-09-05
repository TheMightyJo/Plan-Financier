# Semaine 8 — vitesse : la vitrine d'abord

Aucune action côté Supabase.

## Avant / après (fichiers JS + CSS téléchargés par un premier visiteur)

| | Avant | Après |
|---|---|---|
| Entrée JS | 151 Ko gz | 67 Ko gz |
| Graphiques (recharts) | 108 Ko gz préchargés | 0 (chargés avec l'app) |
| PDF (jspdf) | 134 Ko gz préchargés | 0 (chargés à l'export) |
| Supabase | 48 Ko gz préchargés | 0 (chargés avec l'app) |
| Icônes | 6 Ko gz | 6 Ko gz |
| CSS | 31 Ko gz | 31 Ko gz |
| **Total vitrine** | **≈ 478 Ko gz** | **≈ 104 Ko gz (−78 %)** |

## Ce qui a changé

- `src/Bootstrap.tsx` : nouveau point d'entrée. Sur « / » sans session
  enregistrée, la vitrine s'affiche seule ; l'app (`App.tsx`) est chargée
  paresseusement au clic « Se connecter » / « Essayer la démo » (URL poussée
  vers /login ou /demo, puis l'app reprend le routage). Toute autre URL, ou
  une session existante, charge l'app directement. Préchargement de l'app
  au premier geste (pointeur/clavier) pour une transition instantanée.
- `vite.config.ts` : plus de chunks forcés pour recharts/jspdf (une règle
  trop large attirait des helpers partagés et forçait leur préchargement).
- `lib/errorReporter` : l'identifiant utilisateur est lu dans la session
  stockée, sans importer le client Supabase.
- `AppErrorBoundary` : Supabase importé paresseusement au clic « Se
  déconnecter ».

## Pourquoi c'est important

La vitrine est indexée par Google depuis la semaine 6 (retrait du noindex).
Le temps de chargement compte pour le classement et pour la conversion
(surtout sur mobile 4G). Mesure conseillée après déploiement :
PageSpeed Insights sur https://planfinancier.app/.
