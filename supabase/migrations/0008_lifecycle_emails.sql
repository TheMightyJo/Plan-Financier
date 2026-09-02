-- 0008 — Emails de cycle de vie (bienvenue, relance J+3)
-- ---------------------------------------------------------------------------
-- Journal idempotent : un email d'un type donné n'est envoyé qu'une fois par
-- utilisateur. Écrit uniquement par la fonction Edge lifecycle-emails
-- (service_role) ; l'utilisateur peut lire ses propres lignes.
-- ---------------------------------------------------------------------------

create table if not exists public.lifecycle_emails (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'followup_d3')),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);

alter table public.lifecycle_emails enable row level security;

drop policy if exists "lifecycle_emails_select_own" on public.lifecycle_emails;
create policy "lifecycle_emails_select_own"
  on public.lifecycle_emails for select
  using (auth.uid() = user_id);
-- Pas de policy d'écriture : service_role uniquement (fonction Edge).

-- Index pour la relance J+3 (parcours des profils récemment onboardés).
create index if not exists profiles_onboarding_completed_at_idx
  on public.profiles (onboarding_completed_at);
