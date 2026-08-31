-- 0007 — Abonnements Stripe + quota IA mensuel
-- ---------------------------------------------------------------------------
-- `subscriptions` : un enregistrement par utilisateur, alimenté UNIQUEMENT
--   par les fonctions Edge (service_role) via le webhook Stripe. Le client ne
--   peut que LIRE sa propre ligne.
-- `ai_usage`      : compteur de messages IA par utilisateur et par mois
--   (période 'YYYY-MM'), incrémenté par la fonction Edge `ai-chat`.
-- ---------------------------------------------------------------------------

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium', 'family')),
  status text not null default 'inactive',
  stripe_customer_id text unique,
  stripe_subscription_id text,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = user_id);
-- Aucune policy insert/update/delete : seules les fonctions Edge
-- (service_role, qui contourne la RLS) écrivent dans cette table.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  used integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage_select_own" on public.ai_usage;
create policy "ai_usage_select_own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- Incrément atomique du compteur (évite les pertes en cas d'appels
-- simultanés). Réservé au service_role (fonction Edge ai-chat).
create or replace function public.increment_ai_usage(p_user uuid, p_period text)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, period, used, updated_at)
  values (p_user, p_period, 1, now())
  on conflict (user_id, period)
  do update set used = ai_usage.used + 1, updated_at = now()
  returning used;
$$;

revoke execute on function public.increment_ai_usage(uuid, text) from public;
revoke execute on function public.increment_ai_usage(uuid, text) from anon;
revoke execute on function public.increment_ai_usage(uuid, text) from authenticated;
grant execute on function public.increment_ai_usage(uuid, text) to service_role;
