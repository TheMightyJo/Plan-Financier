-- =============================================================================
-- Plan Financier — suivi des invitations envoyées
-- Migration : 0004_family_sent_invites
--
-- Permet au propriétaire d'un family_group de lister les personnes qu'il a
-- invitées (email + statut), y compris avant acceptation — informations que
-- la RLS standard ne lui donne pas (profils/emails d'autrui).
-- security definer : lit auth.users (email) et profiles, mais UNIQUEMENT pour
-- les memberships des groupes possédés par l'appelant.
-- =============================================================================

create or replace function public.family_sent_invites()
returns table (
  membership_id uuid,
  invited_email text,
  display_name text,
  invited_at timestamptz,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, u.email::text, p.display_name, m.invited_at, m.accepted_at
  from public.family_memberships m
  join public.family_groups g on g.id = m.family_group_id
  left join public.profiles p on p.user_id = m.user_id
  left join auth.users u on u.id = m.user_id
  where g.owner_user_id = auth.uid()
    and g.deleted_at is null
    and m.user_id <> auth.uid()
  order by m.invited_at desc;
$$;

grant execute on function public.family_sent_invites() to authenticated;
