// Edge Function : delete-my-account
// ---------------------------------------------------------------------------
// Supprime *définitivement* l'utilisateur authentifié de auth.users.
// Le CASCADE Postgres propage la suppression vers profiles → toutes les
// tables liées (transactions, accounts, etc.) via les FK on delete cascade
// définies dans supabase/migrations/0001_initial_schema.sql.
//
// Sécurité :
//   - Authentification obligatoire via JWT dans le header Authorization
//   - On utilise un userClient (anon key) pour valider la session
//   - Puis adminClient (service_role) pour appeler auth.admin.deleteUser
//   - Aucun input pris du body : on supprime *uniquement* l'appelant,
//     pas un userId arbitraire (empêche l'escalade de privilège)
//
// Déploiement :
//   supabase functions deploy delete-my-account --no-verify-jwt
//
// (--no-verify-jwt car on vérifie nous-mêmes le JWT dans la fonction,
// ce qui permet de logger les tentatives invalides plutôt que de les
// rejeter silencieusement au niveau du gateway.)
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json(401, { error: 'missing_authorization_header' })
  }

  // 1. Valider la session du caller via la anon key + son JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return json(401, { error: 'invalid_session' })
  }
  const userId = userData.user.id

  // 2. Admin client (service_role) pour l'action privilégiée
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 3. Marquer la rgpd_request comme complétée (si l'utilisateur en avait
  //    créée une depuis le PrivacyPanel)
  try {
    await adminClient
      .from('rgpd_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('kind', 'erase')
      .eq('status', 'pending')
  } catch {
    // Best-effort : la suppression compte reste prioritaire
  }

  // 4. Suppression effective. CASCADE Postgres propage à profiles + toutes
  //    les tables liées (accounts, transactions, recurring_rules,
  //    savings_goals, ai_*, family_memberships, family_groups owned…).
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return json(500, {
      error: 'deletion_failed',
      detail: deleteError.message,
    })
  }

  return json(200, {
    deleted: true,
    userId,
    deletedAt: new Date().toISOString(),
  })
})
