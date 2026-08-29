// Edge Function : invite-family-member
// ---------------------------------------------------------------------------
// Invite une personne (par email) à rejoindre la famille de l'appelant :
//   1. Valide la session de l'appelant (JWT).
//   2. Crée le family_group de l'appelant s'il n'en possède pas encore
//      (le trigger SQL crée sa membership « parent » acceptée).
//   3. Nouvel email → auth.admin.inviteUserByEmail : Supabase ENVOIE l'email
//      d'invitation (création de compte). Email déjà inscrit → on récupère
//      simplement l'utilisateur existant.
//   4. Insère la membership invitée (accepted_at = null) : l'app affiche la
//      bannière « X vous invite » à la prochaine connexion de l'invité.
//
// Sécurité : l'appelant ne peut inviter QUE dans son propre groupe ; aucune
// clé n'est exposée ; l'invité doit accepter côté app (accepted_at).
//
// Déploiement :
//   supabase functions deploy invite-family-member --no-verify-jwt
// ---------------------------------------------------------------------------

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
/** URL de l'app vers laquelle renvoie le lien d'invitation. */
const APP_URL = Deno.env.get('APP_URL') ?? 'https://planfinancier.app'

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  // 1. Session de l'appelant
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser()
  if (userError || !userData.user) {
    return json(401, { error: 'invalid_session' })
  }
  const inviter = userData.user

  let email: string
  let action: 'invite' | 'resend' = 'invite'
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim().toLowerCase()
    if (body.action === 'resend') action = 'resend'
  } catch {
    return json(400, { error: 'invalid_body' })
  }
  if (!EMAIL_RE.test(email)) {
    return json(400, { error: 'invalid_email' })
  }
  if (email === (inviter.email ?? '').toLowerCase()) {
    return json(400, { error: 'cannot_invite_self' })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 2. Groupe familial de l'appelant (créé au besoin)
  const { data: inviterProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('user_id', inviter.id)
    .maybeSingle()
  const inviterName = inviterProfile?.display_name ?? inviter.email ?? 'Un proche'

  let groupId: string
  const { data: existingGroup } = await admin
    .from('family_groups')
    .select('id')
    .eq('owner_user_id', inviter.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingGroup) {
    groupId = existingGroup.id
  } else {
    const { data: createdGroup, error: groupError } = await admin
      .from('family_groups')
      .insert({ name: `Famille de ${inviterName}`, owner_user_id: inviter.id })
      .select('id')
      .single()
    if (groupError || !createdGroup) {
      return json(500, { error: 'group_creation_failed', detail: groupError?.message })
    }
    groupId = createdGroup.id
  }

  // Relance : possible uniquement si l'invité n'a JAMAIS activé son compte
  // (on recrée l'invitation, ce qui renvoie l'email). Sinon, rien à envoyer.
  if (action === 'resend') {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkError || !linkData?.user) {
      return json(404, { error: 'user_not_found' })
    }
    const target = linkData.user
    if (target.email_confirmed_at && target.last_sign_in_at) {
      return json(200, { ok: true, outcome: 'already_active' })
    }
    // Compte jamais activé : suppression + ré-invitation (nouvel email envoyé).
    const { error: deleteError } = await admin.auth.admin.deleteUser(target.id)
    if (deleteError) {
      return json(500, { error: 'resend_failed', detail: deleteError.message })
    }
    // La suite du flux (invite + membership) recrée tout proprement.
  }

  // 3. Utilisateur invité : email d'invitation (nouveau) ou compte existant
  let invitedUserId: string
  let outcome: 'invited_new_user' | 'linked_existing_user'
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: APP_URL,
    data: { invited_by: inviterName },
  })

  if (!inviteError && invited?.user) {
    invitedUserId = invited.user.id
    outcome = 'invited_new_user'
  } else {
    // Compte déjà existant : generateLink n'envoie rien mais résout l'utilisateur.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkError || !linkData?.user) {
      return json(500, { error: 'invite_failed', detail: inviteError?.message })
    }
    invitedUserId = linkData.user.id
    outcome = 'linked_existing_user'
  }

  // 4. Membership invitée (idempotent : unique(group, user))
  const { error: membershipError } = await admin
    .from('family_memberships')
    .upsert(
      { family_group_id: groupId, user_id: invitedUserId, role: 'parent', accepted_at: null },
      { onConflict: 'family_group_id,user_id', ignoreDuplicates: true },
    )
  if (membershipError) {
    return json(500, { error: 'membership_failed', detail: membershipError.message })
  }

  return json(200, { ok: true, outcome, groupId })
})
