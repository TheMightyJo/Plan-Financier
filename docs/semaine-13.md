# Semaine 13 — Monétisation prête

Calendrier : les comptes créés à partir du **1er octobre 2026** ont 30 jours
d'essai complet, puis passent en plan Découverte. Les premiers essais
expirent donc **début novembre** : Stripe doit être en Live avant.

## Ce qui est livré dans l'app
- `src/lib/premiumAccess.ts` (+4 tests) : calcul unique de l'accès
  (démo, plan payant, premiers inscrits offerts, essai avec jours restants).
- **Bandeau** en haut de l'app : 7 derniers jours d'essai (« se termine dans
  N jours »), puis « plan Découverte » ; bouton « Voir les formules »,
  masquable pour la journée.
- Paramètres → Abonnement : jours d'essai restants, description exacte du
  plan Découverte (1 profil, 3 poches, 15 messages Cash, sans rapport email).
- Lien profond `/app?plan=1` → ouvre Paramètres → Abonnement (utilisé par
  les emails et le bandeau).
- Vitrine et modale Premium : formules **honnêtes** (la synchronisation
  multi-appareils et la prévision sont dans Découverte ; Premium = profils et
  poches illimités, 300 messages Cash, rapports email ; Famille = 5 membres,
  500 messages).

## Emails de fin d'essai (fonction `lifecycle-emails`)
- Nouveaux types `trial_ending` (J-3) et `trial_ended` (jour J), envoyés une
  fois par compte par le cron quotidien déjà en place (relance J+3).
- Cibles : comptes créés depuis le 1er octobre 2026, sans abonnement payant
  (`subscriptions.plan ≠ free` et statut actif / trialing / past_due exclus).
- **Migration 0013** à coller (élargit la contrainte `kind`) :

```sql
alter table public.lifecycle_emails drop constraint if exists lifecycle_emails_kind_check;
alter table public.lifecycle_emails
  add constraint lifecycle_emails_kind_check
  check (kind in ('welcome', 'followup_d3', 'trial_ending', 'trial_ended'));
```

- Puis recoller le code de `lifecycle-emails` (dis « code lifecycle »).

## Stripe : passer en Live (côté toi, ~30 min)

### 0. Répétition générale en mode test (avant de basculer)
Dans l'app (compte de test), Paramètres → Abonnement :
1. « Passer Premium » avec la carte `4242 4242 4242 4242` (date future,
   CVC quelconque) → retour dans l'app, la carte affiche ⭐ Premium.
2. « Gérer mon abonnement » → portail Stripe → facture visible, résiliation
   possible → l'app affiche « Résiliation programmée — accès jusqu'au … ».
3. Carte 3-D Secure `4000 0027 6000 3184` : le parcours d'authentification
   s'affiche puis aboutit.
4. Carte refusée `4000 0000 0000 0002` : message d'erreur Stripe, l'app reste
   en Découverte.
5. Stripe → Développeurs → Webhooks → l'endpoint test montre des livraisons
   `200` pour `checkout.session.completed` et `customer.subscription.*`.

### 1. Bascule
1. Stripe → désactiver le mode test (toggle en haut).
2. Recréer 2 produits / 4 prix en Live : Premium 3,99 €/mois et 29,99 €/an,
   Famille 5,99 €/mois et 44,99 €/an, taxes **incluses**.
3. Supabase → Edge Functions → Secrets : `STRIPE_SECRET_KEY` = `sk_live_…`,
   `STRIPE_PRICE_PREMIUM_MONTHLY`, `STRIPE_PRICE_PREMIUM_YEARLY`,
   `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY` (valeurs Live).
4. Stripe Live → Développeurs → Webhooks → ajouter
   `https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/stripe-webhook`
   avec `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copier le `whsec_…` → secret
   `STRIPE_WEBHOOK_SECRET`.
5. Stripe Live → Paramètres → Portail client → activer la résiliation et la
   mise à jour du moyen de paiement → Enregistrer.
6. Stripe → Paramètres → Informations publiques : nom « Plan Financier »,
   email de support `contact@protojo.fr`, libellé de relevé « PLANFINANCIER ».
7. Redéployer `stripe-checkout`, `stripe-portal`, `stripe-webhook` si tu les
   avais déployés avec des secrets en dur (sinon les secrets sont lus à
   chaque appel, rien à faire).

### 2. Vérification réelle
1. Avec ton propre compte : Paramètres → Abonnement → Passer Premium avec ta
   carte → ⭐ Premium s'affiche. Tu peux ensuite te rembourser depuis Stripe.
2. Stripe Live → Webhooks : livraison `200`.
3. Portail : la facture est là, avec la TVA incluse.

## Rien d'autre côté Supabase
Le cron quotidien `lifecycle-emails` existe déjà : les emails de fin d'essai
partiront dès que la migration 0013 est appliquée et le code recollé.

## Complément — rappels d'abonnement dans le tableau de bord

Carte « Votre formule » en tête du rail de droite (Accueil, Budget, Famille,
Statistiques, Dépenses), calculée par `src/lib/planUsage.ts` :

- **Essai Premium** : jours restants + ce que la personne utilise réellement et
  qui dépasse Découverte (profils, poches personnalisées, messages Cash,
  rapports email) → « Garder tout · 3,99 €/mois ». Sans usage Premium : invitation
  à essayer, bouton discret « Voir les formules ».
- **Découverte (essai terminé)** : usage face aux limites (messages Cash avec
  barre, profils 1/1, poches personnalisées en lecture seule) → « Passer Premium ».
- Rien pour les abonnés, les premiers inscrits (gratuit à vie) et la démo.
- « Pas maintenant » masque la carte 7 jours (`plan-financier-plan-card-dismissed-v1`),
  sauf quota Cash épuisé (la carte reste, sans bouton de report).
- Le bouton ouvre Réglages → Abonnement (`openSettingsPanel('subscription')`).
