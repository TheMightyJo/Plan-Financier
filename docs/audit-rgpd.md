# Audit RGPD — Plan Financier

> **Date** : 2026-05-16
> **Périmètre** : code source au commit `98c0c92` (post-migration Supabase)
> **Méthode** : scan code + table-mapping vs schéma SQL + analyse parcours utilisateur

---

## Score global : ⚠️ **5/12** obligations couvertes

| Obligation RGPD | État | Risque légal si lancement public |
|---|---|---|
| Art. 5 — Minimisation des données | ✅ | Faible |
| Art. 6 — Base légale du traitement | ⚠️ Partiel (implicite) | Moyen |
| Art. 7 — Consentement explicite (IA, cookies) | ⚠️ Partiel (IA OK, cookies absent) | Moyen |
| Art. 12-14 — Information du sujet (Privacy Policy) | ❌ **MANQUE** | **Élevé** |
| Art. 15 — Droit d'accès (export) | ❌ Pas d'UI | Élevé |
| Art. 16 — Droit de rectification | ⚠️ Partiel (transactions oui, email non) | Faible |
| Art. 17 — Droit à l'oubli (suppression compte) | ❌ **MANQUE UI** | **Élevé** |
| Art. 20 — Portabilité (export structuré) | ⚠️ CSV transactions seulement | Moyen |
| Art. 25 — Privacy by design | ✅ | Faible |
| Art. 28 — DPA avec sous-traitants (Supabase, IA) | ❓ Action externe utilisateur | Moyen |
| Art. 30 — Registre des traitements | ⚠️ `audit_logs` table existe mais jamais peuplée | Élevé |
| Art. 32 — Sécurité du traitement | ✅ | Faible |

---

## 1. ✅ Minimisation des données (Art. 5)

**Ce qui est fait** :
- Collecte limitée au strict nécessaire : email + password (auth), display_name (dérivé email côté trigger), données financières (saisies par l'user pour la finalité affichée).
- **Pas de tracking** : aucun analytics tiers (pas de Mixpanel/Amplitude/GA).
- **Pas de cookies tiers** : seul localStorage utilisé (pas considéré comme cookie au sens directive ePrivacy).
- **Pas de fingerprinting**.

**Verdict** : conforme.

---

## 2. ⚠️ Base légale (Art. 6)

**Ce qui est fait** :
- Inscription = contrat (l'utilisateur accepte d'utiliser le service).
- Traitements internes (calcul budget, génération récurrences) = exécution du contrat.

**Ce qui manque** :
- ❌ **Aucune mention explicite de la base légale** dans une page dédiée. RGPD demande de **documenter** la base légale par catégorie de traitement (Art. 30).
- ❌ Pas de mention du fondement légal pour la prospection (si futur newsletter / emails marketing).

**Action recommandée** : documenter dans la Privacy Policy (cf. §4).

---

## 3. ⚠️ Consentement (Art. 7)

**Ce qui est fait** :
- Table `ai_consents` versionne et horodate le consentement par provider IA, avec `consent_revoked_at` pour la révocation.
- Onboarding IA mentionne : *« Vous êtes responsable du contrat, de la facturation, des transferts de données et du respect RGPD liés au fournisseur sélectionné. »*

**Ce qui manque** :
- ❌ **L'UI ne capture pas réellement le consentement** : le simple clic "Configurer avec l'IA" est considéré comme consentement implicite. RGPD demande explicite + granulaire.
- ❌ Le composant `AiConsentForm` n'existe pas (la table SQL est prête mais pas branchée).
- ❌ **Pas de bannière cookies** : OK pour V1 (pas de cookies tracking), mais à vérifier si on ajoute Google Analytics ou similar plus tard.

**Action recommandée** : créer `AiConsentModal.tsx` avant le 1er appel IA (étape 4 archi de toute façon).

---

## 4. ❌ Information du sujet (Art. 12-14) — RISQUE ÉLEVÉ

**État actuel** :
- AuthScreen affiche deux liens : "Conditions d'utilisation" et "Politique de confidentialité"
- **Les deux pointent vers `href="#"`** → cliquer ne fait rien
- C'est **trompeur** : l'utilisateur croit accepter quelque chose qui n'existe pas

```tsx
// src/AuthScreen.tsx:370-371
<a href="#" className="auth-rgpd-link">Conditions d'utilisation</a>
<a href="#" className="auth-rgpd-link">Politique de confidentialité</a>
```

**Action OBLIGATOIRE avant tout lancement public** :
1. Rédiger **politique de confidentialité** (cf. template fourni dans [docs/privacy-policy.md](privacy-policy.md))
2. Rédiger **conditions d'utilisation (CGU)**
3. Brancher les liens vers les pages réelles (route `/privacy` + `/terms` ou modal in-app)
4. Logger l'acceptation à l'inscription (insert dans `audit_logs` avec `action = 'tos_accepted'`)

**Risque CNIL** : sanction jusqu'à 4 % du CA mondial ou 20 M€ pour non-information du sujet. Pour un projet perso/petite asso : peu probable mais possible.

---

## 5. ❌ Droit d'accès (Art. 15) — PAS D'UI

**Ce qui existe** :
- Table `rgpd_requests` avec `kind = 'export'` + `status` + `deliverable_storage_path` → modèle prêt
- Export CSV des transactions filtrées dans `TransactionHistoryPanel` (mais partiel)

**Ce qui manque** :
- ❌ Pas de bouton "Demander un export RGPD complet" dans les paramètres
- ❌ Pas d'Edge Function qui assemble TOUS les comptes + transactions + objectifs + récurrences + sessions IA en un seul ZIP/JSON
- ❌ Délai légal : 1 mois (Art. 12), pas de tracker

**Action recommandée** : créer panel "Mes données RGPD" dans Settings avec :
- Bouton "Télécharger mes données" → génère JSON complet localement (V1)
- En V2 : Edge Function qui compile depuis Postgres + envoie un lien par email

---

## 6. ⚠️ Droit de rectification (Art. 16)

**Ce qui est fait** :
- L'utilisateur peut éditer ses transactions, comptes, objectifs, règles récurrentes via les panels respectifs.

**Ce qui manque** :
- ❌ Pas d'UI pour modifier son email (Supabase supporte `supabase.auth.updateUser({ email })`)
- ❌ Pas d'UI pour modifier son `display_name`

**Action recommandée** : créer un écran "Profil" dans Settings (cf. cahier des charges §8 — écran #14 prévu V1.5).

---

## 7. ❌ Droit à l'oubli (Art. 17) — PAS D'UI

**État actuel** :
- AuthScreen mentionne : *« Vous pouvez supprimer votre compte et l'ensemble de vos données à tout moment depuis les paramètres. »*
- **MAIS aucune UI dans les paramètres ne le permet** → mention trompeuse

**Ce qui existe côté SQL** :
- Trigger `on delete cascade` côté `profiles → ...` → si on supprime la row `auth.users`, tout est purgé automatiquement.

**Ce qui manque** :
- ❌ Bouton "Supprimer mon compte" dans Settings
- ❌ Confirmation forte (saisie email + PIN parent)
- ❌ Action effective : `supabase.auth.admin.deleteUser(userId)` nécessite **service_role key** → Edge Function obligatoire
- ❌ Purge du localStorage côté client en parallèle

**Action recommandée** : créer Edge Function `delete-my-account` (service_role) + UI confirmation dans Settings.

---

## 8. ⚠️ Portabilité (Art. 20)

**Ce qui est fait** :
- Export CSV des transactions filtrées (séparateur `;`, BOM UTF-8 Excel-friendly)

**Ce qui manque** :
- ❌ Pas d'export des autres entités : comptes, objectifs, règles récurrentes, catégories custom, paramètres
- ❌ Format JSON (plus portable que CSV pour les structures imbriquées)

**Action recommandée** : ajouter export JSON global au panel "Mes données RGPD".

---

## 9. ✅ Privacy by design (Art. 25)

**Ce qui est fait** :
- PIN parent local **jamais synchronisé** (PBKDF2 hashé côté navigateur, table SQL ne le contient pas)
- LocalStorage pour données métier V1 (pas d'envoi serveur par défaut)
- RLS Postgres activée sur les 14 tables → user ne peut accéder qu'à ses propres rows
- CSP restrictive dans `index.html` (limite XSS)
- Pipeline anonymisation IA prévu (étape 4 archi)
- `audit_logs` immuable (revoke UPDATE/DELETE)
- Pas de tracking, pas de fingerprinting, pas de cookies tiers
- Hosting EU (Supabase Frankfurt)

**Verdict** : conforme et même au-dessus de la moyenne du marché.

---

## 10. ❓ DPA avec sous-traitants (Art. 28)

**Sous-traitants identifiés** :
| Sous-traitant | Rôle | DPA requis | État |
|---|---|---|---|
| Supabase | Hébergement Auth + Postgres + Storage + Edge | ✅ Oui | ❓ À vérifier — Supabase fournit un DPA standard, à signer dans l'admin |
| Anthropic / OpenAI / Mistral / Google / OpenRouter | Processing IA (V2) | ✅ Oui | ❓ Chacun a son DPA — l'utilisateur (= toi en tant qu'éditeur) doit l'accepter |
| Resend / Postmark (V1.5 si SMTP custom) | Envoi emails transactionnels | ✅ Oui | ❓ À configurer si on quitte le SMTP Supabase par défaut |

**Action côté toi (responsable de traitement)** :
1. Va sur https://supabase.com/dashboard/project/lgcprvjpemvphjicubaf/settings/general → **Data Processing Addendum** → accepter
2. Documenter la liste des sous-traitants dans la Privacy Policy

---

## 11. ⚠️ Registre des traitements (Art. 30) — STRUCTURE OK, USAGE MANQUANT

**État actuel** :
- Table `audit_logs` (id, user_id, action, entity, entity_id, ip_country, user_agent_hash, metadata, occurred_at) existe et est **immuable** (revoke UPDATE/DELETE).
- **MAIS aucun code ne fait `INSERT INTO audit_logs`**.

**Verdict** : on a la cuisine, on ne fait pas la cuisine.

**Actions techniques recommandées** :
1. Wrapper côté front qui log chaque action critique :
   - `login` / `logout`
   - `export` (CSV ou export RGPD)
   - `erase_request` (demande suppression compte)
   - `pin_change`
   - `transaction_delete` (massive)
   - `share_account` (mode famille V2)
   - `ai_consent_given` / `ai_consent_revoked`
2. Côté serveur : trigger Postgres `AFTER INSERT/UPDATE/DELETE` sur les tables sensibles qui logge dans `audit_logs` (V2, ne demande aucun code client).

**Action documentation (obligatoire RGPD)** :
- Tenir un **registre des activités de traitement** (papier/markdown) : pour chaque traitement, base légale + finalité + catégories de données + durée de conservation + destinataires + transferts hors UE + mesures de sécurité.
- Template fourni dans [docs/registre-traitements.md](registre-traitements.md) — **à créer**.

---

## 12. ✅ Sécurité du traitement (Art. 32)

**Ce qui est fait** :
- PIN parent : PBKDF2-SHA256 200k itérations + sel aléatoire 16 octets, comparaison à temps constant
- Auth Supabase : email/password + Google OAuth, sessions JWT avec refresh tokens
- RLS Postgres exhaustive
- CSP restrictive
- HTTPS forcé (Supabase + Vite preview)
- `AppErrorBoundary` empêche les leaks de stack trace en prod
- TypeScript strict mode → réduit les bugs runtime
- 102 tests unitaires sur la couche métier
- Pas de `dangerouslySetInnerHTML`, `eval`, `any` dans le code applicatif

**Ce qui manque (mineur)** :
- ⏳ Audit_logs effectivement peuplés (cf. §11)
- ⏳ Plan d'intervention en cas de violation (Art. 33-34, notif CNIL 72h)
- ⏳ Tests de pénétration (à planifier avant lancement public)

**Verdict** : conforme, niveau au-dessus de la moyenne SaaS début de vie.

---

## 🎯 Priorisation des actions

### 🔴 Bloquant lancement public (à faire avant ouverture aux vrais users)

| # | Action | Effort |
|---|---|---|
| 1 | Rédiger Privacy Policy + brancher le lien `href="#"` | 1 jour |
| 2 | Rédiger CGU + brancher le lien | 0.5 jour |
| 3 | Implémenter "Supprimer mon compte" (Edge Function + UI confirmation) | 1.5 jour |
| 4 | Implémenter "Exporter mes données RGPD" (V1 = client-side JSON) | 0.5 jour |
| 5 | Accepter le DPA Supabase + documenter sous-traitants | 0.5 jour |

**Total** : ~4 jours-dev (1 semaine en mode normal).

### 🟠 Conformité renforcée (V1.5)

| # | Action | Effort |
|---|---|---|
| 6 | Brancher `audit_logs` côté front (5 actions critiques minimum) | 0.5 jour |
| 7 | Page Profil avec rectification email/display_name | 0.5 jour |
| 8 | Modal consentement IA explicite (couple avec étape 4 archi) | 0.5 jour |
| 9 | Registre des traitements documenté (registre-traitements.md) | 0.5 jour |

### 🟢 Bonus / maturité (V2+)

| # | Action | Effort |
|---|---|---|
| 10 | Triggers Postgres `audit_logs` AFTER write sur tables sensibles | 0.5 jour |
| 11 | Edge Function `request-data-export` qui envoie un ZIP par email | 1 jour |
| 12 | Page transparence : "Qui voit quoi, qui traite quoi" lisible | 1 jour |
| 13 | DPIA (Data Protection Impact Assessment) si > 5000 users | 2 jours |

---

## 📋 Récap : ce qui peut tomber sur ton portable si la CNIL frappe à la porte demain

| Risque | Probabilité réelle | Comment l'éviter |
|---|---|---|
| Sanction "défaut d'information" (Art. 12-14) | **Élevée** (constat trivial sur visite simple) | Privacy Policy + CGU réels avant ouverture |
| Sanction "non-respect droit d'accès" (Art. 15) | Moyenne (déclenchée par une plainte user) | UI export RGPD |
| Sanction "non-respect droit à l'oubli" (Art. 17) | Moyenne (idem plainte user) | UI suppression compte |
| Sanction "défaut de sécurité" (Art. 32) | Faible | Déjà bon niveau ; ajouter audit_logs effectifs |
| Sanction "absence de registre" (Art. 30) | Élevée si > 250 employés (non) — sinon recommandé | registre-traitements.md |

**Plan d'action concret** : Si tu vises un lancement public ouvert (même petit), faire le bloc 🔴 (5 actions, ~1 semaine) est non négociable. Le reste s'enchaîne sur V1.5.
