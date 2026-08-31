# Déploiement — IA incluse (proxy + quotas) et abonnements Stripe

Guide pas-à-pas pour activer les deux systèmes livrés ensemble :

- **IA incluse** : l'assistant Cash fonctionne sans clé personnelle, via la
  fonction Edge `ai-chat` (clé Anthropic côté serveur, quota mensuel par plan).
- **Abonnements Stripe** : Premium 3,99 €/mois (29,99 €/an) et Famille
  5,99 €/mois (44,99 €/an), avec portail client pour la résiliation.

## 1. Base de données

Exécuter la migration [supabase/migrations/0007_billing_and_ai_quota.sql](../supabase/migrations/0007_billing_and_ai_quota.sql)
dans le SQL Editor de Supabase (après les migrations 0004 → 0006 si elles ne
sont pas déjà passées). Elle crée :

- `subscriptions` — plan de chaque utilisateur (écrit uniquement par le webhook) ;
- `ai_usage` — compteur de messages IA par mois ;
- `increment_ai_usage()` — incrément atomique (service_role uniquement).

## 2. IA incluse

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy ai-chat --no-verify-jwt
```

Quotas actuels (modifiables dans `supabase/functions/ai-chat/index.ts`) :
Découverte **15** messages/mois · Premium **300** · Famille **500**.
Une clé personnelle saisie dans Paramètres → Assistant IA reste prioritaire et
sans quota (comportement historique conservé).

## 3. Stripe

1. Créer un compte sur stripe.com (activer le mode test d'abord).
2. Dans **Produits**, créer :
   - « Plan Financier Premium » : prix récurrent 3,99 €/mois **et** 29,99 €/an ;
   - « Plan Financier Famille » : prix récurrent 5,99 €/mois **et** 44,99 €/an.
3. Copier les 4 identifiants `price_…` et la clé secrète `sk_…`, puis :

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_PRICE_PREMIUM_MONTHLY=price_... \
  STRIPE_PRICE_PREMIUM_YEARLY=price_... \
  STRIPE_PRICE_FAMILY_MONTHLY=price_... \
  STRIPE_PRICE_FAMILY_YEARLY=price_...
supabase functions deploy stripe-checkout --no-verify-jwt
supabase functions deploy stripe-portal --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

4. Dans Stripe → **Développeurs → Webhooks**, ajouter l'endpoint
   `https://<ref-projet>.supabase.co/functions/v1/stripe-webhook` avec les
   événements `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Copier le secret `whsec_…` :

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

5. Dans Stripe → **Paramètres → Portail client**, activer le portail
   (résiliation + changement de formule) — l'app l'ouvre via « Gérer mon
   abonnement ».

## 4. Comportement côté app (déjà en place)

- Paramètres → **Abonnement** : plan actuel, jauge du quota IA, boutons
  Premium/Famille (Checkout) et portail client.
- Tant que Stripe n'est pas configuré, les boutons affichent « Les paiements
  ne sont pas encore ouverts » — rien ne casse.
- Retour de paiement : `/app?checkout=success` → toast de confirmation.
- Le mode démo bloque abonnement et IA incluse (clé perso mémoire uniquement).
