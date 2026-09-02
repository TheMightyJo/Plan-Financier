# Semaine 1 — mise en service (checklist)

Quatre actions à fort impact. Le code est en place ; il reste la
configuration des services (à faire une fois, ~1 h au total).

## 1. IA incluse (Cash sans clé personnelle)

Dashboard Supabase → projet `lgcprvjpemvphjicubaf`.

1. **SQL Editor** → exécuter `supabase/migrations/0008_lifecycle_emails.sql`
   puis `0009_billing_grants.sql` (0007 est déjà appliquée en prod).
2. **Edge Functions → Secrets** → `ANTHROPIC_API_KEY` = clé `sk-ant-…`
   (console.anthropic.com → API Keys ; une clé dédiée « serveur » facilite
   le suivi des coûts).
3. **Edge Functions → Deploy a new function → via Editor** → nom `ai-chat`
   → coller `supabase/functions/ai-chat/index.ts` → Deploy → dans les
   réglages de la fonction, **désactiver « Enforce JWT verification »**.
4. Test : app connectée, sans clé perso dans Paramètres → Assistant IA,
   poser une question à Cash. Paramètres → Abonnement affiche « X / 15 ».

## 2. Stripe en mode Live

1. Stripe → **désactiver le mode test** (toggle en haut).
2. Recréer les 2 produits / 4 prix en Live (les `price_…` du mode test ne
   marchent pas en Live) : Premium 3,99 €/mois + 29,99 €/an, Famille
   5,99 €/mois + 44,99 €/an, taxes **Inclusif**.
3. Supabase → Secrets : `STRIPE_SECRET_KEY` = `sk_live_…`, et les 4
   `STRIPE_PRICE_*` (valeurs Live).
4. Déployer (ou redéployer) `stripe-checkout`, `stripe-portal`,
   `stripe-webhook` (JWT désactivé pour les trois).
5. Stripe Live → Développeurs → Webhooks → endpoint
   `https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/stripe-webhook`
   avec `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copier le `whsec_…` Live →
   Secret `STRIPE_WEBHOOK_SECRET`.
6. Stripe Live → Paramètres → Portail client → **Enregistrer** (résiliation
   activée).
7. Test réel : passer Premium avec ta propre carte (tu peux te rembourser
   depuis Stripe ensuite) → Paramètres → Abonnement doit afficher ⭐ Premium.

## 3. Emails de bienvenue + relance J+3

Fonction `lifecycle-emails` (Resend, déjà configuré pour les rapports).

1. Deploy via Editor → nom `lifecycle-emails` → coller
   `supabase/functions/lifecycle-emails/index.ts` → JWT désactivé.
   Secrets requis (déjà présents pour `send-report`) : `RESEND_API_KEY`,
   `CRON_SECRET`, `REPORT_FROM`. Ajouter `APP_URL` = `https://planfinancier.app`.
2. L'email de **bienvenue** part automatiquement à la fin de l'onboarding
   (une seule fois par compte).
3. La **relance J+3** est envoyée par un cron quotidien — SQL Editor
   (remplacer `<CRON_SECRET>`) :

```sql
select cron.schedule(
  'plan-financier-relance-j3',
  '30 8 * * *',
  $$
  select net.http_post(
    url := 'https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/lifecycle-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);
```

(`pg_cron` et `pg_net` doivent être activés : Database → Extensions.)

## 4. HSTS

Déjà activé dans `public/.htaccess` (livré avec ce lot). Rien à faire.
Dans quelques semaines sans incident HTTPS, ajouter `; preload` puis
soumettre sur hstspreload.org (optionnel).
