# Edge Function : `delete-my-account`

Supprime *définitivement* l'utilisateur authentifié (`auth.users` + CASCADE Postgres vers `profiles` → toutes les tables liées).

Conforme RGPD Art. 17 (droit à l'oubli) : la suppression est immédiate, irréversible (au-delà du délai backups Supabase ~7j), et tracée via `rgpd_requests` qui est marqué `completed`.

## Déploiement

### Pré-requis
- CLI Supabase installée + projet lié (`supabase link --project-ref <ref>` déjà fait pour ce repo)
- `SUPABASE_SERVICE_ROLE_KEY` disponible dans le dashboard (Project Settings → API)

### Commande

```bash
# Deploy
supabase functions deploy delete-my-account --no-verify-jwt

# Vérifier que la fonction est listée
supabase functions list
```

> `--no-verify-jwt` car la fonction vérifie elle-même le JWT en interne
> (pour pouvoir logger les tentatives invalides avant de rejeter).

### Variables d'environnement

Aucune variable à configurer manuellement : `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont **auto-injectées** par Supabase dans toute Edge Function.

## Test

### Côté CLI

```bash
# Récupérer un JWT user via login
curl -X POST https://lgcprvjpemvphjicubaf.supabase.co/auth/v1/token?grant_type=password \
  -H "apikey: <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"<test-email>","password":"<test-password>"}'
# → copie le access_token de la réponse

# Appel à la function
curl -X POST https://lgcprvjpemvphjicubaf.supabase.co/functions/v1/delete-my-account \
  -H "Authorization: Bearer <access_token>" \
  -H "apikey: <anon-key>"
# → { deleted: true, userId: "...", deletedAt: "..." }
```

### Côté front

Bouton "Supprimer mon compte" dans le PrivacyPanel — la fonction est appelée automatiquement après la double confirmation email + PIN.

Si la fonction n'est pas déployée, le front bascule en **fallback** : la suppression côté client (localStorage + signOut) est faite, et la row `rgpd_requests` est créée pour traçabilité — l'éditeur traite manuellement sous 30j.

## Sécurité

- ✅ Authentification obligatoire (rejette 401 sans JWT)
- ✅ Vérification du JWT via `userClient.auth.getUser()` (anon key + JWT user)
- ✅ Suppression UNIQUEMENT de l'utilisateur appelant (pas de `userId` arbitraire en input → impossible d'escalade)
- ✅ `service_role` jamais exposée au front
- ✅ CORS configuré pour POST + OPTIONS uniquement
- ✅ `rgpd_requests` mis à jour avec horodatage `completed_at`

## Audit

Chaque suppression réussie laisse :
- Un log `erase_request` dans `audit_logs` (côté front, AVANT signOut)
- Une row `rgpd_requests` avec `status = 'completed'` + `completed_at` timestamp
- Les logs Supabase Edge Function (visibles dans Dashboard → Edge Functions → Logs)

**Note** : les `audit_logs` du user supprimé sont eux-mêmes purgés par le CASCADE (`audit_logs.user_id REFERENCES profiles ON DELETE CASCADE`). Pour conserver une trace audit après suppression, ajouter une table `audit_logs_archive` sans FK (V1.2).
