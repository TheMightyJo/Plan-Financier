# Semaine 5 — rapport hebdo par défaut, découpage, contenu

## À faire côté Supabase (2 redéploiements)

Deux fonctions ont changé, à recoller via l'éditeur du dashboard :

1. **`send-report`** (`supabase/functions/send-report/index.ts`) : le cron
   respecte désormais le gating doux — rapports envoyés si plan payant
   actif, ou compte créé avant le 1er oct. 2026, ou essai < 30 jours.
2. **`lifecycle-emails`** (`supabase/functions/lifecycle-emails/index.ts`) :
   l'email de bienvenue mentionne le bilan hebdomadaire.

## Ce qui change dans l'app

- **Bilan hebdomadaire activé par défaut** à la fin de l'onboarding (si
  aucune préférence n'existait). Désactivable dans Paramètres → Rapport
  par email. Le cron des rapports tourne à 7h00 UTC (cf. semaine 1).
- `App.tsx` 8 956 → 8 570 lignes : `CashChatPanel` (assistant) et
  `QuickAddModal` (ajout rapide) extraits, JSX conservé.

## Contenu

- Articles : « Épargne de précaution : combien mettre de côté » et
  « Parler d'argent en couple sans se disputer ».
- `docs/marketing/tiktok-30-jours.md` : 30 idées de vidéos, une par jour,
  organisées problème → méthode → quotidien → preuve.
