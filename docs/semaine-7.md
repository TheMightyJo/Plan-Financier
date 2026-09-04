# Semaine 7 — notifications push (bilan du dimanche)

Le bilan de la semaine arrive en notification sur le téléphone ou
l'ordinateur, le dimanche soir, même l'app fermée : « Votre semaine :
Normal ✅ — +180 € · dépensé 420 €, reçu 600 € ». Web Push standard
(VAPID), aucun service tiers : le message est calculé par la fonction Edge
`send-push` à partir des transactions synchronisées.

## Mise en service (≈ 10 min)

1. **SQL Editor** → exécuter `supabase/migrations/0011_push_subscriptions.sql`.
2. **Edge Functions → Secrets** → ajouter :
   - `VAPID_PUBLIC_KEY` — la clé publique (identique à celle intégrée dans l'app)
   - `VAPID_PRIVATE_KEY` — la clé privée (fournie séparément, à ne jamais
     mettre dans le code)
   - `VAPID_SUBJECT` = `mailto:contact@protojo.fr`
3. **Deploy via Editor** → `send-push` ← `supabase/functions/send-push/index.ts`,
   **désactiver « Enforce JWT verification »**.
4. **Cron** — dimanche 17h00 UTC (19h Paris en été, 18h en hiver) :

```sql
select cron.schedule(
  'plan-financier-push-hebdo',
  '0 17 * * 0',
  $$
  select net.http_post(
    url := 'https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{"cron": true}'::jsonb
  );
  $$
);
```

5. **Test** : planfinancier.app connecté → Paramètres → 🔔 Notifications →
   activer « Bilan du dimanche soir » (le navigateur demande l'autorisation)
   → « Envoyer une notification de test ».

## Côté utilisateur

- Chrome, Edge, Firefox, Android : activation directe.
- **iPhone / iPad** : l'app doit d'abord être installée sur l'écran
  d'accueil (Paramètres → Installer l'app) ; la section Notifications le
  rappelle et y renvoie.
- Chaque appareil s'abonne séparément ; désactivation en un clic.
- Un abonnement expiré (410/404) est supprimé automatiquement à l'envoi.

## Notes techniques

- La clé publique VAPID est intégrée dans `src/lib/pushNotifications.ts`
  (elle n'est pas secrète) ; `VITE_VAPID_PUBLIC_KEY` la surcharge si besoin
  (secret GitHub optionnel).
- `public/sw.js` : événements `push` (affichage) et `notificationclick`
  (ouvre /app/statistiques). Cache passé en v3.
- La fonction utilise `npm:web-push` (chiffrement Web Push standard).
