# Emails : expéditeur `contact@protojo.fr` + logo

Deux circuits envoient des emails :

| Circuit | Emails | Expéditeur aujourd'hui | Cible |
|---|---|---|---|
| **Supabase Auth** (SMTP) | confirmation d'inscription, reset mot de passe, changement d'email | `noreply@mail.app.supabase.io` (SMTP Supabase par défaut, ~4 emails/h) | `Plan Financier <contact@protojo.fr>` via SMTP Resend |
| **Fonctions Edge** (API Resend) | bienvenue, relance J+3, rapports, digest erreurs | secret `REPORT_FROM` (défaut code : `contact@protojo.fr`) | idem |

Le logo est **embarqué** dans les emails des fonctions (PNG 96×96 en base64,
pièce jointe inline `cid:`) : il s'affiche même quand le client mail bloque le
contenu distant (Apple Mail « Charger le contenu distant »). Les templates
Supabase Auth ([supabase-email-templates.md](supabase-email-templates.md))
référencent `https://planfinancier.app/logo.png` (le SMTP Auth n'accepte pas
de pièce jointe).

Le rapport par email (`send-report`) comprend : bonjour + comparaison avec la
période précédente, dépensé / reçu / solde, répartition par catégorie avec
barres, 5 plus grosses dépenses, détail des opérations (format détaillé),
bouton « Ouvrir mon tableau de bord ». Le PDF joint reprend la même structure
(bandeau, indicateurs, barres, tableau paginé).

Il reste 3 actions côté dashboards, dans cet ordre.

## 1. Vérifier le domaine `protojo.fr` dans Resend (10 min)

Resend → **Domains → Add domain** → `protojo.fr` → région **EU (Ireland)**.
Resend affiche 3 enregistrements à créer dans **OVH → Domaines → protojo.fr → Zone DNS** :

| Type | Sous-domaine | Valeur | Rôle |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGf…` (copier depuis Resend) | DKIM (signature) |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` priorité 10 | retours (bounces) |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | SPF |

> Si `protojo.fr` a déjà un SPF sur la racine (`@`), ne pas y toucher : Resend
> utilise le sous-domaine `send.protojo.fr`, il n'y a pas de conflit.

Attendre le statut **Verified** (quelques minutes à 1 h). Sans ça, Resend
refuse les envois depuis `@protojo.fr`.

## 2. Fonctions Edge : le secret `REPORT_FROM`

Supabase → **Edge Functions → Secrets** :

```
REPORT_FROM = Plan Financier <contact@protojo.fr>
```

Aucun redéploiement nécessaire : les fonctions lisent le secret à chaque appel.
Pour vérifier : Paramètres → Rapport par email → « M'envoyer un rapport maintenant ».

## 3. Supabase Auth : SMTP Resend

Resend → **API Keys → Create** (permission *Sending access*, domaine `protojo.fr`).
Puis Supabase → **Project Settings → Authentication → SMTP Settings → Enable Custom SMTP** :

| Champ | Valeur |
|---|---|
| Sender email | `contact@protojo.fr` |
| Sender name | `Plan Financier` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clé API Resend |
| Minimum interval between emails | `60` s (défaut) |

Sauvegarder, puis **Authentication → Rate Limits** : passer « emails per hour »
de 4 à 30 (le SMTP custom lève la limite Supabase).

Enfin coller les templates (logo inclus) : **Authentication → Email Templates**
→ *Confirm signup*, *Reset password*, *Change email* depuis
[supabase-email-templates.md](supabase-email-templates.md).

## Vérification

1. Créer un compte test avec une adresse perso → l'email de confirmation arrive
   de `Plan Financier <contact@protojo.fr>` avec le logo.
2. Paramètres → « M'envoyer un rapport maintenant » → même expéditeur.
3. Resend → **Emails** : les deux envois apparaissent avec le statut *Delivered*.

## Réponses des utilisateurs

`contact@protojo.fr` doit exister comme boîte (OVH MX Plan ou redirection) :
les utilisateurs répondent parfois directement à l'email de bienvenue.
