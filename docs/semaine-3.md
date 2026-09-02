# Semaine 3 — monitoring, rate limiting IA, blog

## 1. Monitoring des erreurs (sans tiers)

L'app remonte ses erreurs de production (erreurs JS, promesses rejetées,
erreurs de rendu) à la fonction Edge `report-error`, qui les déduplique
dans la table `client_errors` et envoie un **digest quotidien** par email.

1. **SQL Editor** → exécuter `supabase/migrations/0010_client_errors_and_ai_rate.sql`.
2. **Edge Functions → Deploy via Editor** → nom `report-error` → coller
   `supabase/functions/report-error/index.ts` → **désactiver « Enforce JWT verification »**
   (appel public par l'app, clé anon).
3. **Secrets** → `ADMIN_EMAIL` = l'adresse qui reçoit le digest (défaut
   `contact@protojo.fr`).
4. Cron du digest (8h00 UTC) — SQL Editor, remplacer `<CRON_SECRET>` :

```sql
select cron.schedule(
  'plan-financier-erreurs-digest',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/report-error',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{"cron": true}'::jsonb
  );
  $$
);
```

Aucun email n'est envoyé les jours sans erreur. Pour consulter le détail
(pile d'appels) : Table Editor → `client_errors`, ou :

```sql
select occurrences, message, url, last_seen from public.client_errors
order by last_seen desc limit 50;
```

## 2. Rate limiting IA

`ai-chat` limite désormais à **10 messages par minute et par utilisateur**
(en plus du quota mensuel). Il faut **redéployer `ai-chat`** avec le nouveau
code (`supabase/functions/ai-chat/index.ts`) après la migration 0010.

## 3. Blog

Deux nouveaux articles (`content/blog/`), publiés automatiquement au
déploiement : rentrée scolaire, et « application budget sans connexion
bancaire ». Ajouter un article : voir `docs/blog.md`.
