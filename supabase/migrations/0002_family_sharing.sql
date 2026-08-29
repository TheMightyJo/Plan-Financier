-- =============================================================================
-- Plan Financier — partage familial (étape 3.A)
-- Migration : 0002_family_sharing
--
-- Objectif : une fois deux comptes reliés par un family_group (invitation
-- acceptée des deux côtés), chaque membre peut VOIR (lecture seule) les
-- comptes et transactions personnels des autres membres — c'est ce qui
-- alimente la vue « Famille » fusionnée côté app.
--
-- Les policies d'écriture ne changent pas : chacun ne modifie que ses données.
-- =============================================================================

-- Membres acceptés des groupes dont JE suis membre accepté (moi inclus).
-- security definer : contourne la RLS de family_memberships (un membre non
-- « parent » ne voit pas les memberships des autres, mais doit pouvoir
-- résoudre ses pairs pour la lecture partagée).
create or replace function public.family_peer_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct m1.user_id
  from public.family_memberships m1
  join public.family_memberships m2
    on m1.family_group_id = m2.family_group_id
  where m2.user_id = auth.uid()
    and m2.accepted_at is not null
    and m1.accepted_at is not null;
$$;

-- Invitations en attente pour l'utilisateur courant (avec le nom du groupe et
-- de l'hôte — informations que la RLS standard ne lui donne pas encore).
create or replace function public.family_pending_invites()
returns table (
  membership_id uuid,
  family_group_id uuid,
  group_name text,
  inviter_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, g.id, g.name, p.display_name
  from public.family_memberships m
  join public.family_groups g on g.id = m.family_group_id
  join public.profiles p on p.user_id = g.owner_user_id
  where m.user_id = auth.uid()
    and m.accepted_at is null
    and g.deleted_at is null;
$$;

-- Pairs de famille avec leur nom d'affichage (pour étiqueter la vue fusionnée).
create or replace function public.family_peers_info()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name
  from public.profiles p
  where p.user_id in (select public.family_peer_ids());
$$;

grant execute on function public.family_peer_ids() to authenticated;
grant execute on function public.family_pending_invites() to authenticated;
grant execute on function public.family_peers_info() to authenticated;

-- Lecture croisée : les membres acceptés d'un même groupe voient les comptes
-- et transactions PERSONNELS les uns des autres (fusion familiale).
create policy accounts_select_family_peer on public.accounts
  for select using (
    deleted_at is null
    and owner_user_id in (select public.family_peer_ids())
  );

create policy transactions_select_family_peer on public.transactions
  for select using (
    deleted_at is null
    and created_by_user_id in (select public.family_peer_ids())
  );
