# Politique de confidentialité — Plan Financier

> **Dernière mise à jour** : 2026-05-16
> **Version** : 1.0 (V1 — à remplacer par la version juridiquement validée avant lancement public)
>
> ⚠️ Ce document est un **template** qui couvre les obligations RGPD principales mais
> doit être adapté à ta situation réelle (statut éditeur, coordonnées, sous-traitants
> effectivement utilisés). Faire valider par un juriste avant publication.

---

## 1. Qui est responsable du traitement de vos données ?

**Éditeur** : [À COMPLÉTER — nom de l'éditeur (toi en perso, ton asso, ta société)]
**Adresse** : [À COMPLÉTER]
**Contact** : [À COMPLÉTER — email de contact RGPD, ex. `privacy@plan-financier.fr`]
**Représentant légal** : [À COMPLÉTER]

Vous pouvez contacter notre responsable de traitement à tout moment à l'adresse ci-dessus pour exercer vos droits (cf. §7).

---

## 2. Quelles données collectons-nous ?

### 2.1 Données d'authentification (obligatoires)

- **Email** : identifiant de votre compte
- **Mot de passe** : haché par Supabase (notre sous-traitant Auth), nous n'y avons jamais accès en clair
- **Identifiant utilisateur (UUID)** : généré automatiquement par Supabase

### 2.2 Données de profil (optionnelles)

- **Nom d'affichage** : par défaut, la partie locale de votre email (avant le `@`). Modifiable à tout moment.
- **Préférences IA** : si vous activez l'assistant IA, votre choix de fournisseur (Anthropic / OpenAI / Mistral / Google / OpenRouter) et la version des conditions acceptées.

### 2.3 Données métier (saisies par vous)

- **Comptes** : nom, type (courant / livret / espèces / etc.), solde d'ouverture, couleur.
- **Transactions** : libellé, montant, date, catégorie, enveloppe, compte rattaché.
- **Règles récurrentes** : libellé, montant, fréquence, jour, date de début/fin.
- **Objectifs d'épargne** : nom, montant cible, date cible, compte dédié optionnel.
- **Catégories personnalisées** : nom, couleur, icône.
- **Budgets** (V2) : plafond par catégorie x mois.
- **Groupes famille** (V2) : nom, membres, rôles (parent / enfant / viewer).

### 2.4 Données de sécurité locale (jamais transmises au serveur)

- **PIN parent** : 4-6 chiffres choisis par vous, haché localement (PBKDF2-SHA256 200 000 itérations + sel aléatoire) et stocké uniquement dans le navigateur. **Jamais envoyé à Supabase ou à un tiers**.
- **Sel local** : valeur aléatoire générée à l'installation, stockée localement.

### 2.5 Données d'audit (V1.5)

- **Logs d'événements critiques** : connexion, déconnexion, export de données, changement de PIN, suppression de compte. Inclut un horodatage, le pays (pas l'IP brute) et un hash anonyme du User-Agent.
- Conservés 1 an puis purgés automatiquement.

### 2.6 Données IA (V2, si vous activez l'assistant)

- **Sessions de conversation** : horodatage début/fin, fournisseur utilisé, nombre de tokens consommés.
- **Messages échangés** : stockés **anonymisés** — les noms propres et montants exacts sont remplacés par des placeholders (`{{NAME_1}}`, `{{AMOUNT_1}}`) avant tout envoi au fournisseur IA et avant stockage.

### 2.7 Ce que nous NE collectons PAS

- ❌ Aucun cookie tiers, aucun pixel publicitaire
- ❌ Aucun outil d'analytics (Google Analytics, Mixpanel, Amplitude, etc.)
- ❌ Aucune empreinte navigateur (fingerprinting)
- ❌ Aucune donnée de localisation GPS
- ❌ Aucune connexion à votre banque (pas d'agrégation Open Banking type Bridge/Tink)
- ❌ Aucune donnée biométrique

---

## 3. Pourquoi collectons-nous ces données ?

Conformément à l'article 6 du RGPD, voici les bases légales de nos traitements :

| Traitement | Base légale | Finalité |
|---|---|---|
| Création de compte (email/password) | Exécution du contrat | Vous fournir l'accès au service |
| Stockage des transactions et comptes | Exécution du contrat | Vous fournir la fonctionnalité de budget |
| Hachage du PIN parent | Intérêt légitime + sécurité | Protéger l'accès à vos données sur un appareil partagé |
| Assistant IA (si activé) | Consentement explicite | Vous fournir un coaching financier personnalisé |
| Logs d'audit | Intérêt légitime + obligation légale | Sécurité, détection de fraude, conformité RGPD |
| Email de confirmation, reset password | Exécution du contrat | Sécuriser l'accès à votre compte |

---

## 4. Avec qui partageons-nous vos données ?

Vos données ne sont **jamais vendues** ni partagées à des fins publicitaires. Elles sont uniquement traitées par les sous-traitants techniques suivants :

| Sous-traitant | Rôle | Localisation des données | DPA |
|---|---|---|---|
| **Supabase** | Hébergement Auth, base Postgres, Storage, Edge Functions | Frankfurt, Allemagne (UE) | [DPA Supabase](https://supabase.com/legal/dpa) signé |
| **Fournisseur IA choisi** (Anthropic / OpenAI / Mistral / Google / OpenRouter) | Traitement des messages anonymisés | Variable selon le fournisseur — vous choisissez | DPA propre à chaque fournisseur, vous l'acceptez à l'activation |
| **Resend** (V1.5, prévu) | Envoi des emails transactionnels (confirmation, reset) | UE | [DPA Resend](https://resend.com/legal/dpa) à signer |

### Cas particuliers

- **Fournisseur IA** : les messages que vous échangez avec l'assistant IA sont **anonymisés avant envoi** (cf. §2.6). Le fournisseur reçoit un texte sans nom propre ni montant exact, et ne peut pas vous identifier.
- **Mode famille (V2)** : les transactions d'un compte partagé sont visibles par les autres membres du groupe famille (avec rôle approprié). Vous contrôlez qui rejoint votre groupe.
- **Aucun transfert hors UE** par défaut. Si vous choisissez un fournisseur IA hors UE (ex. OpenAI / Anthropic basés US), le transfert est encadré par les clauses contractuelles types de la Commission européenne et vous y consentez explicitement à l'activation.

---

## 5. Combien de temps gardons-nous vos données ?

| Type de donnée | Durée de conservation |
|---|---|
| Compte actif (auth, profil) | Tant que votre compte existe |
| Transactions, comptes, objectifs, budgets | Tant que votre compte existe + 30 jours après suppression (corbeille soft) |
| Logs d'audit | 1 an puis purge automatique |
| Sessions IA (messages anonymisés) | 3 mois puis purge automatique (configurable par vous) |
| Données après suppression de compte | Purgées sous 30 jours maximum (cascade Postgres + purge backups) |

Vous pouvez à tout moment supprimer votre compte (cf. §7). Cette action est **irréversible** au-delà du délai de 30 jours.

---

## 6. Comment vos données sont-elles sécurisées ?

- **Chiffrement en transit** : HTTPS / TLS 1.3 pour toutes les communications client ↔ serveur.
- **Chiffrement au repos** : base Postgres Supabase chiffrée AES-256 (gestion Supabase).
- **Authentification** : Supabase Auth avec JWT et refresh tokens. Sessions expirent automatiquement.
- **Row-Level Security (RLS)** : chaque utilisateur ne peut accéder qu'à ses propres rows en base, garanti au niveau Postgres et non au niveau application.
- **PIN parent** : haché localement avec PBKDF2-SHA256 (200 000 itérations), jamais transmis.
- **Content Security Policy (CSP)** restrictive : limite les sources de scripts/styles autorisées.
- **Audit logs immuables** : les logs d'événements critiques ne peuvent être ni modifiés ni supprimés, même par leur propriétaire.
- **Hébergement EU** : tous nos serveurs principaux sont en Allemagne (Frankfurt, Supabase EU region).

---

## 7. Quels sont vos droits ?

Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :

| Droit | Comment l'exercer dans l'app |
|---|---|
| **Droit d'accès** (Art. 15) | Settings → "Mes données RGPD" → "Télécharger mes données" (JSON complet) |
| **Droit de rectification** (Art. 16) | Settings → "Profil" pour email/nom ; édition directe pour les transactions/comptes/etc. |
| **Droit à l'effacement** (Art. 17) | Settings → "Mes données RGPD" → "Supprimer mon compte" (confirmation requise) |
| **Droit à la limitation** (Art. 18) | Contactez-nous à l'email du §1 |
| **Droit à la portabilité** (Art. 20) | Settings → "Mes données RGPD" → "Télécharger mes données" (format JSON) |
| **Droit d'opposition** (Art. 21) | Contactez-nous à l'email du §1 |
| **Droit de retirer son consentement** (Art. 7) | Pour l'IA : Settings → "Assistant IA" → "Révoquer le consentement" |
| **Droit d'introduire une réclamation** | Auprès de la CNIL : https://www.cnil.fr/fr/plaintes |

**Délai de réponse** : 1 mois maximum (Art. 12), prolongeable à 3 mois si la demande est complexe (avec justification).

---

## 8. Cookies et stockage local

Plan Financier **n'utilise pas de cookies** au sens de la directive ePrivacy.

L'application utilise **`localStorage` du navigateur** pour stocker localement :
- Vos transactions, comptes, objectifs, règles récurrentes (en attendant la sync Supabase V1.5)
- Vos préférences (thème, widgets visibles, fournisseur IA)
- Votre PIN parent haché
- Le token de session Supabase

Le `localStorage` reste sur votre appareil et n'est **jamais lu par un tiers**. Vous pouvez le vider à tout moment via les paramètres de votre navigateur (cela vous déconnectera et effacera les données qui ne sont pas encore synchronisées sur Supabase).

---

## 9. Mineurs

Plan Financier n'est pas destiné aux personnes de moins de 15 ans. Si vous êtes parent et activez le mode famille, vous êtes responsable des comptes que vous attribuez à vos enfants. Aucune fonctionnalité de profilage ou de publicité ciblée n'est appliquée aux comptes "enfant".

---

## 10. Modifications de cette politique

Cette politique peut être mise à jour. Toute modification substantielle vous sera notifiée par email et nécessitera votre acceptation à votre prochaine connexion. L'historique des versions est consultable [ici](https://github.com/TheMightyJo/Plan-Financier/commits/main/docs/privacy-policy.md).

---

## 11. Contact

Pour toute question relative à cette politique ou à l'exercice de vos droits :

📧 [À COMPLÉTER — email de contact]
📬 [À COMPLÉTER — adresse postale si applicable]

**Délégué à la Protection des Données (DPO)** : [À COMPLÉTER — nom du DPO si désigné, ou indiquer "non applicable - structure < 250 employés"]
