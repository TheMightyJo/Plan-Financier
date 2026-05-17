# Déploiement sur OVH — planfinancier.app

> **Domaine** : `planfinancier.app`
> **Hébergeur** : OVH (mutualisé Perso/Pro/Performance ou VPS)
> **Stack** : SPA Vite (build statique) + Supabase (Auth + Postgres + Storage)

---

## 1. Préparation côté Supabase (10 min, à faire AVANT le 1er déploiement)

### URL configuration

Dashboard Supabase → **Authentication → URL Configuration** :

- **Site URL** : `https://planfinancier.app`
- **Additional redirect URLs** : ajouter
  - `https://planfinancier.app/*`
  - `http://localhost:5173/*` (à garder pour le dev local)

Sans cette étape : les emails de confirmation Supabase pointeront vers localhost et casseront pour les vrais users.

### Email templates

Vérifier que les templates dans **Authentication → Email Templates** utilisent bien la variable `{{ .ConfirmationURL }}` (qui hérite du Site URL ci-dessus). Templates dispos : [docs/supabase-email-templates.md](supabase-email-templates.md).

### SMTP custom (optionnel mais recommandé en prod)

Le SMTP par défaut Supabase est rate-limité à ~4 emails/heure → tu vas vite te faire bloquer en prod. Configurer **Project Settings → Auth → SMTP Settings** avec un service tiers :

| Service | Free tier | Notes |
|---|---|---|
| **Resend** | 3000 emails/mois | Hosting EU dispo, recommandé |
| **Postmark** | 100/jour | Excellent deliverability |
| **SendGrid** | 100/jour | Plus mainstream |
| **OVH MX Plan** | Inclus avec le domaine | Limite quotidienne stricte |

---

## 2. Configuration DNS chez OVH (15 min)

### Si le domaine est déjà chez OVH (cas par défaut puisque tu l'as acheté chez eux)

**Espace client OVH → Domaines → planfinancier.app → Zone DNS** :

#### Pour un hébergement mutualisé OVH

OVH pré-configure automatiquement les enregistrements quand tu associes le domaine à ton hébergement (via **Hébergements → Configuration → Domaines associés**).

Vérifier que ces enregistrements existent :

| Type | Cible | TTL |
|---|---|---|
| A | IP de ton hébergement OVH (visible dans **Hébergements → Informations générales**) | 3600 |
| AAAA | IPv6 de ton hébergement (si dispo) | 3600 |
| CNAME `www` | `planfinancier.app.` | 3600 |

#### Pour un VPS / Cloud OVH

Mêmes records A/AAAA avec l'IP fixe du VPS, mais tu géreras Nginx ou Apache toi-même.

### Propagation

DNS Made Easy ou [dnschecker.org](https://dnschecker.org) pour vérifier la propagation (5 min à 24h selon le TTL).

---

## 3. Activation HTTPS / SSL (5 min)

### Mutualisé OVH

**Hébergements → Multisite** : pour `planfinancier.app`, cliquer **Modifier** → cocher **SSL** → **Valider**.

OVH génère automatiquement un certificat **Let's Encrypt** (renouvelé tous les 3 mois automatiquement). Délai d'émission : 1 à 4 heures.

Le `.htaccess` qu'on a préparé force déjà la redirection HTTPS — ne PAS activer aussi côté OVH "Forcer HTTPS" pour éviter le double-redirect.

### VPS / Cloud

Installer `certbot` :
```bash
sudo apt install certbot python3-certbot-apache  # ou nginx
sudo certbot --apache -d planfinancier.app -d www.planfinancier.app
```

---

## 4. Build local (1 min)

```bash
cd "/Users/johanquille/Documents/GitHub/Plan Financier"

# S'assurer que .env.local pointe sur les bonnes valeurs prod
# (mêmes que dev pour V1 — pas de séparation env Supabase, à faire en V2)

npm run build
```

Le dossier `dist/` est généré avec :
- `index.html` (entrée)
- `assets/` (JS/CSS hashés)
- `logo.png`, `.htaccess` (copiés depuis `public/`)

⚠️ Vérifier que `dist/.htaccess` existe bien (Vite copie tout le contenu de `public/`).

---

## 5. Upload du build vers OVH (5-15 min)

### Option A — SFTP via client GUI (Cyberduck / FileZilla / Transmit)

**Identifiants** : Espace client OVH → **Hébergements → FTP-SSH** :
- Hôte : `ftp.cluster0XX.hosting.ovh.net` (ton cluster spécifique)
- User : `<login>-ovh`
- Mot de passe : celui défini à la création
- Port : 22 (SFTP)

**Chemin cible** : `/www/` (dossier racine du domaine principal). Pour un multi-domaine, l'hébergement OVH peut router via sous-dossier — vérifier dans **Hébergements → Multisite**.

**Action** :
1. Connecter
2. Aller dans `/www/`
3. **Supprimer le contenu existant** (sauf si tu hébergeas autre chose dessus)
4. **Uploader le contenu de `dist/`** (PAS le dossier `dist/` lui-même — son contenu)
5. Vérifier que `.htaccess` est bien uploadé (parfois les clients FTP masquent les fichiers commençant par `.` — activer "Afficher les fichiers cachés")

### Option B — rsync via SSH (plus rapide pour updates)

```bash
# Build local
npm run build

# Upload (remplace le contenu de /www/)
rsync -avz --delete \
  ./dist/ \
  <login>-ovh@ftp.cluster0XX.hosting.ovh.net:/home/<login>/www/
```

### Option C — GitHub Actions auto-deploy (recommandé long terme)

Workflow `.github/workflows/deploy-ovh.yml` qui build + upload via SFTP à chaque push sur `main`. Je peux te le préparer si tu veux — dis-moi quand.

---

## 6. Vérifications post-déploiement (10 min)

### Tests fonctionnels

- [ ] https://planfinancier.app → AuthScreen s'affiche (pas le bandeau "Configuration requise")
- [ ] https://planfinancier.app/dashboard → ne donne PAS un 404 Apache (le `.htaccess` rewrite vers index.html)
- [ ] Refresh sur une route deep (F5 sur `/dashboard`) → toujours OK
- [ ] Inscription d'un nouveau compte → email reçu → lien clique → connexion auto
- [ ] Création d'une transaction → persistée (localStorage en V1)
- [ ] Téléchargement du PDF mensuel
- [ ] Suppression compte (panel RGPD) → Edge Function appelée

### Tests techniques

```bash
# HTTPS redirect actif
curl -I http://planfinancier.app | grep -i location
# → Location: https://planfinancier.app/

# Cache headers OK
curl -I https://planfinancier.app/assets/index-xxxx.js | grep -i cache-control
# → cache-control: public, max-age=31536000, immutable

# index.html no-cache
curl -I https://planfinancier.app/ | grep -i cache-control
# → cache-control: no-cache, no-store, must-revalidate

# GZIP actif
curl -H "Accept-Encoding: gzip" -I https://planfinancier.app/assets/index-xxxx.js | grep -i content-encoding
# → content-encoding: gzip

# Headers sécurité
curl -I https://planfinancier.app/ | grep -iE "x-(frame|content)-options|referrer|permissions"
```

### Tests outils tiers

- **Lighthouse** (Chrome DevTools → Lighthouse) : viser ≥ 90 en Performance / Accessibility / Best Practices / SEO
- **securityheaders.com** : viser grade A
- **ssllabs.com/ssltest** : viser A+ (Let's Encrypt OVH = généralement A)

---

## 7. Mise à jour `index.html` pour la prod

Avant le premier vrai lancement public, retirer le `noindex,nofollow` qui empêche le référencement Google :

```html
<!-- AVANT (état actuel) -->
<meta name="robots" content="noindex, nofollow" />

<!-- APRÈS (prod ouverte) -->
<meta name="robots" content="index, follow" />
```

Et compléter les meta Open Graph (Facebook, LinkedIn, WhatsApp share previews) :

```html
<meta property="og:url" content="https://planfinancier.app" />
<meta property="og:image" content="https://planfinancier.app/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

À créer : `public/og-image.png` (1200×630, fond crème + logo FP + slogan).

---

## 8. Mise à jour Privacy Policy + CGU

Ouvrir `src/components/PrivacyPolicyModal.tsx` et remplacer les placeholders côté modal **et** dans `docs/privacy-policy.md` :

- Section 1 (Privacy) : nom de l'éditeur, adresse postale, email contact RGPD
- Section 11 (Privacy) : email de contact + DPO si applicable
- Sections CGU si tu veux des conditions plus détaillées

---

## 9. Workflow déploiement régulier

Une fois la première mise en ligne faite :

```bash
# 1. Pull latest main
git pull origin main

# 2. Build
npm run build

# 3. Tests sanity (optionnel mais conseillé)
npm test

# 4. Upload (rsync ou GitHub Action)
rsync -avz --delete ./dist/ user@ftp.cluster.ovh.net:/home/<login>/www/
```

Délai user → prod : ~1-2 min (cache index.html = no-cache, les users voient la nouvelle version au prochain refresh).

---

## 10. Troubleshooting fréquent

| Symptôme | Cause probable | Fix |
|---|---|---|
| "404 Not Found" sur F5 d'une route | `.htaccess` pas uploadé OU `mod_rewrite` désactivé | Vérifier présence + chmod 644 ; OVH active `mod_rewrite` par défaut |
| "Bandeau Configuration Supabase requis" en prod | Build fait sans `.env.local` rempli OU env vars différentes en prod | Vérifier que `npm run build` a bien lu `.env.local` |
| Email confirmation Supabase pointe sur localhost | Site URL pas mise à jour | Cf. §1 |
| Page blanche, console "Failed to fetch" | CSP bloque, ou Supabase URL invalide | Vérifier `connect-src` dans `index.html`, vérifier .env.local |
| HTTPS warning navigateur | Cert pas encore émis (Let's Encrypt prend jusqu'à 4h) | Attendre, OU forcer un renouvellement OVH dans l'admin |
| Cache toujours ancien après update | Cache CDN intermédiaire OU `index.html` cachée | `Ctrl+F5` côté user. Vérifier headers `Cache-Control: no-cache` sur index.html |

---

## Coûts mensuels estimés (référence)

| Item | Coût |
|---|---|
| Domaine planfinancier.app | ~15 €/an (renouvellement) |
| Hébergement OVH Perso | ~3 €/mois (suffisant V1, ~25k visites/mois) |
| Hébergement OVH Pro | ~7 €/mois (V2+ recommandé, plus de RAM PHP/cron) |
| Supabase free tier | 0 € (jusqu'à 50k MAU + 500 MB DB) |
| Supabase Pro | 25 €/mois (au-delà du free tier) |
| Resend (emails) | 0 € (3000/mois free) ou 20 €/mois (Pro) |

**Total V1 (< 5k users)** : ~3-5 €/mois + renouvellement domaine.
