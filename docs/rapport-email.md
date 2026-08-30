# Rapport automatique par email — installation

L'utilisateur choisit sa fréquence (hebdo/mensuel) et son format dans
**Paramètres → Rapport par email**. L'envoi est réalisé par l'Edge Function
`send-report`, déclenchée chaque matin par une tâche planifiée.

## 1. Migration

SQL Editor → exécuter `supabase/migrations/0005_report_preferences.sql`.

## 2. Compte Resend (envoi des emails — gratuit)

1. Créer un compte sur https://resend.com (offre gratuite : 100 emails/jour).
2. API Keys → créer une clé (`re_...`).
3. Sans domaine vérifié, Resend n'envoie qu'à l'adresse email du compte
   Resend (parfait pour tester). Pour envoyer à tous les utilisateurs :
   Domains → ajouter `planfinancier.app` → créer les 3 enregistrements DNS
   proposés dans la zone OVH → puis définir le secret
   `REPORT_FROM = Plan Financier <rapport@planfinancier.app>`.

## 3. Déployer la fonction + secrets

Dashboard → Edge Functions → nouvelle fonction `send-report` (coller
`supabase/functions/send-report/index.ts`).

Onglet Secrets de la fonction :
- `RESEND_API_KEY` : la clé Resend
- `CRON_SECRET` : une chaîne aléatoire longue (ex. sortie de `openssl rand -hex 24`)
- `REPORT_FROM` (optionnel, après vérification du domaine)

Le bouton « Recevoir un rapport test maintenant » fonctionne dès cette étape.

## 4. Planification quotidienne (07h00 UTC)

Dashboard → Database → Extensions : activer `pg_cron` et `pg_net` si besoin.
Puis SQL Editor (remplacer `<CRON_SECRET>` par la valeur du secret) :

```sql
select cron.schedule(
  'plan-financier-rapports',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/send-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{"cron": true}'::jsonb
  );
  $$
);
```

Chaque matin, la fonction envoie les rapports « dus » : hebdo si le dernier
date de plus de ~7 jours, mensuel si aucun envoi ce mois-ci (bilan du mois
précédent complet).

## Notes

- Les rapports sont construits à partir des transactions **synchronisées**
  (Postgres). Un utilisateur jamais synchronisé recevrait un rapport vide.
- Supprimer la tâche : `select cron.unschedule('plan-financier-rapports');`

## Mise à jour (options de rapport — migration 0006)

Nouveautés : pièce jointe (PDF, CSV ou Excel générée par la fonction) et
adresses en copie des rapports automatiques (max 5 — le rapport test, lui,
n'est envoyé qu'à vous).

À faire une fois :

1. **SQL Editor** → exécuter `supabase/migrations/0006_report_options.sql`
   (ajoute les colonnes `attachment` et `cc_emails`).
2. **Redéployer** la fonction `send-report` (le code gère les deux options ;
   sans la migration, il retombe proprement sur l'email seul).
