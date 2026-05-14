-- =============================================================================
-- Plan Financier — schéma initial
-- Migration : 0001_initial_schema
-- Référence  : docs/architecture.md §4
--
-- Conventions :
--   * id uuid PK (gen_random_uuid)
--   * created_at / updated_at / deleted_at sur toutes les tables métier
--   * montants : numeric(12, 2) (jamais float)
--   * RLS activée partout, policies en bas du fichier
--   * service_role conserve l'accès complet (bypass RLS) — réservé Edge Functions
--
-- Convention soft delete :
--   * `deleted_at` = horodatage de suppression logique. Les SELECT policies
--     filtrent `deleted_at is null` ; les rows conservent l'historique.
--   * Les policies DELETE restent autorisées pour le hard delete (cascade vers
--     enfants), à utiliser pour les purges RGPD ou la suppression définitive.
--   * Le mode normal est `update set deleted_at = now()` — réversible.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- emails case-insensitive si besoin

-- -----------------------------------------------------------------------------
-- Helpers (fonctions sécurité)
-- -----------------------------------------------------------------------------

-- Renvoie true si l'utilisateur courant est membre actif du family_group donné.
create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_group_id = target_family_id
      and user_id         = auth.uid()
      and accepted_at     is not null
  );
$$;

-- Renvoie true si l'utilisateur courant est parent du family_group donné.
create or replace function public.is_family_parent(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_memberships
    where family_group_id = target_family_id
      and user_id         = auth.uid()
      and role            = 'parent'
      and accepted_at     is not null
  );
$$;

-- Trigger générique : met à jour updated_at à chaque UPDATE.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- Tables
-- =============================================================================

-- 1. profiles ----------------------------------------------------------------
create table public.profiles (
  user_id                  uuid primary key references auth.users(id) on delete cascade,
  display_name             text not null,
  avatar_storage_path      text,
  default_currency         char(3) not null default 'EUR',
  ai_consent_given_at      timestamptz,
  ai_provider_preference   text check (ai_provider_preference in ('anthropic','openai','mistral','google','openrouter')),
  anonymization_level      smallint not null default 2 check (anonymization_level between 0 and 2),
  locale                   text not null default 'fr-FR',
  onboarding_completed_at  timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 2. family_groups -----------------------------------------------------------
create table public.family_groups (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_user_id uuid not null references public.profiles(user_id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index idx_family_groups_owner on public.family_groups(owner_user_id);
create trigger trg_family_groups_updated_at
  before update on public.family_groups
  for each row execute function public.touch_updated_at();

-- 3. family_memberships ------------------------------------------------------
create table public.family_memberships (
  id              uuid primary key default gen_random_uuid(),
  family_group_id uuid not null references public.family_groups(id) on delete cascade,
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  role            text not null check (role in ('parent','child','viewer')),
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (family_group_id, user_id)
);
create index idx_memberships_user on public.family_memberships(user_id);
create trigger trg_memberships_updated_at
  before update on public.family_memberships
  for each row execute function public.touch_updated_at();

-- 4. accounts ----------------------------------------------------------------
create table public.accounts (
  id                uuid primary key default gen_random_uuid(),
  owner_user_id     uuid references public.profiles(user_id) on delete cascade,
  family_group_id   uuid references public.family_groups(id) on delete cascade,
  name              text not null,
  type              text not null check (type in ('checking','savings','cash','envelope','credit_card','investment')),
  currency          char(3) not null default 'EUR',
  initial_balance   numeric(12, 2) not null default 0,
  display_color     text,
  display_icon      text,
  archived_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  -- un compte appartient soit à un user soit à un family_group, jamais les deux
  constraint accounts_owner_xor_family check (
    (owner_user_id is not null and family_group_id is null)
    or (owner_user_id is null and family_group_id is not null)
  )
);
create index idx_accounts_owner  on public.accounts(owner_user_id) where owner_user_id is not null;
create index idx_accounts_family on public.accounts(family_group_id) where family_group_id is not null;
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.touch_updated_at();

-- 5. categories --------------------------------------------------------------
create table public.categories (
  id                  uuid primary key default gen_random_uuid(),
  owner_user_id       uuid references public.profiles(user_id) on delete cascade,  -- null = catégorie système
  name                text not null,
  icon                text,
  color               text,
  parent_category_id  uuid references public.categories(id) on delete set null,
  kind                text not null check (kind in ('expense','income','transfer')),
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_categories_owner on public.categories(owner_user_id);
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.touch_updated_at();

-- 6. recurring_rules ---------------------------------------------------------
create table public.recurring_rules (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.accounts(id) on delete cascade,
  category_id        uuid references public.categories(id) on delete set null,
  label              text not null,
  amount             numeric(12, 2) not null check (amount > 0),
  kind               text not null check (kind in ('debit','credit')),
  frequency          text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  -- Sémantique de day_of_period dépend de frequency :
  --   weekly  → 1..7 (1 = lundi … 7 = dimanche, ISO 8601)
  --   monthly / quarterly / yearly → 1..31 (jour du mois ; le job de génération
  --   fallback au dernier jour du mois si la date est invalide, ex. 31 février).
  day_of_period      smallint not null,
  start_date         date not null,
  end_date           date,
  last_generated_on  date,
  paused_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint recurring_day_matches_frequency check (
    (frequency = 'weekly'  and day_of_period between 1 and 7)
    or (frequency in ('monthly','quarterly','yearly') and day_of_period between 1 and 31)
  )
);
create index idx_recurring_account on public.recurring_rules(account_id);
create trigger trg_recurring_updated_at
  before update on public.recurring_rules
  for each row execute function public.touch_updated_at();

-- 7. transactions ------------------------------------------------------------
create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references public.accounts(id) on delete cascade,
  category_id        uuid references public.categories(id) on delete set null,
  amount             numeric(12, 2) not null check (amount > 0),
  kind               text not null check (kind in ('debit','credit','transfer')),
  occurred_at        date not null,
  label              text not null,
  notes              text,
  paid_by_user_id    uuid references public.profiles(user_id) on delete set null,
  created_by_user_id uuid not null references public.profiles(user_id) on delete restrict,
  recurring_rule_id  uuid references public.recurring_rules(id) on delete set null,
  receipt_storage_path text,
  ai_categorized     boolean not null default false,
  -- Pour kind = 'transfer' : un transfert = 2 rows (debit source + credit destination)
  -- partageant le même transfer_group_id pour pouvoir être appariées.
  -- Pour les autres kinds : NULL.
  transfer_group_id  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint transactions_transfer_group_consistent check (
    (kind = 'transfer' and transfer_group_id is not null)
    or (kind <> 'transfer' and transfer_group_id is null)
  )
);
create index idx_transactions_account_date on public.transactions(account_id, occurred_at desc);
create index idx_transactions_category     on public.transactions(category_id);
create index idx_transactions_paid_by      on public.transactions(paid_by_user_id);
create index idx_transactions_transfer     on public.transactions(transfer_group_id) where transfer_group_id is not null;
create trigger trg_transactions_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- 8. budgets -----------------------------------------------------------------
create table public.budgets (
  id                       uuid primary key default gen_random_uuid(),
  owner_user_id            uuid references public.profiles(user_id) on delete cascade,
  family_group_id          uuid references public.family_groups(id) on delete cascade,
  category_id              uuid not null references public.categories(id) on delete cascade,
  period                   char(7) not null,  -- 'YYYY-MM'
  planned_amount           numeric(12, 2) not null check (planned_amount >= 0),
  rollover_from_previous   boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint budgets_owner_xor_family check (
    (owner_user_id is not null and family_group_id is null)
    or (owner_user_id is null and family_group_id is not null)
  )
);
create index idx_budgets_period on public.budgets(period);
-- Unicité par scope. Index partiels : sans `where ... is not null`, Postgres
-- considère les NULL distincts dans les index uniques et la contrainte fuit.
create unique index uq_budgets_owner_cat_period
  on public.budgets (owner_user_id, category_id, period)
  where owner_user_id is not null;
create unique index uq_budgets_family_cat_period
  on public.budgets (family_group_id, category_id, period)
  where family_group_id is not null;
create trigger trg_budgets_updated_at
  before update on public.budgets
  for each row execute function public.touch_updated_at();

-- 9. savings_goals -----------------------------------------------------------
create table public.savings_goals (
  id                      uuid primary key default gen_random_uuid(),
  owner_user_id           uuid references public.profiles(user_id) on delete cascade,
  family_group_id         uuid references public.family_groups(id) on delete cascade,
  label                   text not null,
  target_amount           numeric(12, 2) not null check (target_amount > 0),
  target_date             date,
  destination_account_id  uuid references public.accounts(id) on delete set null,
  display_color           text,
  achieved_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  deleted_at              timestamptz,
  constraint savings_owner_xor_family check (
    (owner_user_id is not null and family_group_id is null)
    or (owner_user_id is null and family_group_id is not null)
  )
);
create trigger trg_savings_updated_at
  before update on public.savings_goals
  for each row execute function public.touch_updated_at();

-- 10. ai_consents ------------------------------------------------------------
create table public.ai_consents (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(user_id) on delete cascade,
  provider            text not null check (provider in ('anthropic','openai','mistral','google','openrouter')),
  terms_version       text not null,
  consent_given_at    timestamptz not null default now(),
  consent_revoked_at  timestamptz,
  created_at          timestamptz not null default now()
);
create index idx_ai_consents_user_active on public.ai_consents(user_id, provider) where consent_revoked_at is null;

-- 11. ai_sessions ------------------------------------------------------------
create table public.ai_sessions (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(user_id) on delete cascade,
  provider                 text not null,
  pseudonym_token          text not null,                  -- token random injecté à la place du nom
  started_at               timestamptz not null default now(),
  ended_at                 timestamptz,
  prompt_tokens_total      integer not null default 0,
  completion_tokens_total  integer not null default 0,
  created_at               timestamptz not null default now()
);
create index idx_ai_sessions_user on public.ai_sessions(user_id, started_at desc);

-- 12. ai_session_messages ----------------------------------------------------
create table public.ai_session_messages (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references public.ai_sessions(id) on delete cascade,
  role                text not null check (role in ('user','assistant','system')),
  content_anonymized  text not null,    -- noms remplacés par {{NAME_1}}, {{AMOUNT_1}}…
  tokens_used         integer not null default 0,
  created_at          timestamptz not null default now()
);
create index idx_ai_messages_session on public.ai_session_messages(session_id, created_at);

-- 13. audit_logs -------------------------------------------------------------
create table public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(user_id) on delete cascade,
  action          text not null,
  entity          text,
  entity_id       uuid,
  ip_country      char(2),                   -- pas l'IP brute, juste le pays (RGPD-friendly)
  user_agent_hash text,
  metadata        jsonb,
  occurred_at     timestamptz not null default now()
);
create index idx_audit_user_date on public.audit_logs(user_id, occurred_at desc);

-- 14. rgpd_requests ----------------------------------------------------------
create table public.rgpd_requests (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null references public.profiles(user_id) on delete cascade,
  kind                     text not null check (kind in ('export','erase','rectify','portability')),
  status                   text not null check (status in ('pending','processing','completed','rejected')) default 'pending',
  requested_at             timestamptz not null default now(),
  completed_at             timestamptz,
  deliverable_storage_path text
);
create index idx_rgpd_user on public.rgpd_requests(user_id, requested_at desc);

-- =============================================================================
-- Row-Level Security (RLS)
-- =============================================================================
-- Principe : authenticated users n'accèdent qu'à leurs propres rows ou à celles
-- de leurs family_groups. service_role bypasse la RLS.

alter table public.profiles            enable row level security;
alter table public.family_groups       enable row level security;
alter table public.family_memberships  enable row level security;
alter table public.accounts            enable row level security;
alter table public.categories          enable row level security;
alter table public.recurring_rules     enable row level security;
alter table public.transactions        enable row level security;
alter table public.budgets             enable row level security;
alter table public.savings_goals       enable row level security;
alter table public.ai_consents         enable row level security;
alter table public.ai_sessions         enable row level security;
alter table public.ai_session_messages enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.rgpd_requests       enable row level security;

-- Empêcher modification/suppression des audit_logs même par leur owner
revoke update, delete on public.audit_logs from authenticated;

-- ------------------------------- profiles -----------------------------------
create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid());

create policy profiles_insert_self on public.profiles
  for insert with check (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid());

-- ------------------------------- family_groups ------------------------------
create policy family_groups_select_member on public.family_groups
  for select using (
    deleted_at is null
    and (public.is_family_member(id) or owner_user_id = auth.uid())
  );

create policy family_groups_insert_self on public.family_groups
  for insert with check (owner_user_id = auth.uid());

create policy family_groups_update_owner on public.family_groups
  for update using (owner_user_id = auth.uid());

create policy family_groups_delete_owner on public.family_groups
  for delete using (owner_user_id = auth.uid());

-- ------------------------------- family_memberships -------------------------
-- Voir : ses propres memberships OU celles de familles dont on est parent
create policy memberships_select on public.family_memberships
  for select using (user_id = auth.uid() or public.is_family_parent(family_group_id));

create policy memberships_insert_parent on public.family_memberships
  for insert with check (public.is_family_parent(family_group_id));

create policy memberships_update_self_or_parent on public.family_memberships
  for update using (user_id = auth.uid() or public.is_family_parent(family_group_id));

create policy memberships_delete_parent on public.family_memberships
  for delete using (public.is_family_parent(family_group_id));

-- ------------------------------- accounts -----------------------------------
create policy accounts_select on public.accounts
  for select using (
    deleted_at is null
    and (
      owner_user_id = auth.uid()
      or (family_group_id is not null and public.is_family_member(family_group_id))
    )
  );

create policy accounts_insert on public.accounts
  for insert with check (
    (owner_user_id = auth.uid() and family_group_id is null)
    or (family_group_id is not null and public.is_family_parent(family_group_id))
  );

create policy accounts_update on public.accounts
  for update using (
    owner_user_id = auth.uid()
    or (family_group_id is not null and public.is_family_parent(family_group_id))
  );

create policy accounts_delete on public.accounts
  for delete using (
    owner_user_id = auth.uid()
    or (family_group_id is not null and public.is_family_parent(family_group_id))
  );

-- ------------------------------- categories ---------------------------------
-- Tous peuvent lire les catégories système (owner_user_id null) ;
-- chacun gère uniquement les siennes.
create policy categories_select on public.categories
  for select using (owner_user_id is null or owner_user_id = auth.uid());

create policy categories_insert_self on public.categories
  for insert with check (owner_user_id = auth.uid());

create policy categories_update_own on public.categories
  for update using (owner_user_id = auth.uid());

create policy categories_delete_own on public.categories
  for delete using (owner_user_id = auth.uid());

-- ------------------------------- recurring_rules ----------------------------
create policy recurring_select on public.recurring_rules
  for select using (
    exists (
      select 1 from public.accounts a
      where a.id = recurring_rules.account_id
        and (
          a.owner_user_id = auth.uid()
          or (a.family_group_id is not null and public.is_family_member(a.family_group_id))
        )
    )
  );

create policy recurring_modify on public.recurring_rules
  for all using (
    exists (
      select 1 from public.accounts a
      where a.id = recurring_rules.account_id
        and (
          a.owner_user_id = auth.uid()
          or (a.family_group_id is not null and public.is_family_parent(a.family_group_id))
        )
    )
  );

-- ------------------------------- transactions -------------------------------
create policy transactions_select on public.transactions
  for select using (
    deleted_at is null
    and exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id
        and a.deleted_at is null
        and (
          a.owner_user_id = auth.uid()
          or (a.family_group_id is not null and public.is_family_member(a.family_group_id))
        )
    )
  );

create policy transactions_insert on public.transactions
  for insert with check (
    created_by_user_id = auth.uid()
    and exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id
        and (
          a.owner_user_id = auth.uid()
          or (a.family_group_id is not null and public.is_family_member(a.family_group_id))
        )
    )
  );

create policy transactions_update on public.transactions
  for update using (
    exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id
        and (
          a.owner_user_id = auth.uid()
          or (a.family_group_id is not null and public.is_family_member(a.family_group_id))
        )
    )
  );

create policy transactions_delete on public.transactions
  for delete using (
    exists (
      select 1 from public.accounts a
      where a.id = transactions.account_id
        and (
          a.owner_user_id = auth.uid()
          or (a.family_group_id is not null and public.is_family_parent(a.family_group_id))
        )
    )
  );

-- ------------------------------- budgets ------------------------------------
create policy budgets_select on public.budgets
  for select using (
    owner_user_id = auth.uid()
    or (family_group_id is not null and public.is_family_member(family_group_id))
  );

create policy budgets_modify on public.budgets
  for all using (
    owner_user_id = auth.uid()
    or (family_group_id is not null and public.is_family_parent(family_group_id))
  );

-- ------------------------------- savings_goals ------------------------------
create policy savings_select on public.savings_goals
  for select using (
    deleted_at is null
    and (
      owner_user_id = auth.uid()
      or (family_group_id is not null and public.is_family_member(family_group_id))
    )
  );

create policy savings_modify on public.savings_goals
  for all using (
    owner_user_id = auth.uid()
    or (family_group_id is not null and public.is_family_parent(family_group_id))
  );

-- ------------------------------- ai_consents --------------------------------
create policy ai_consents_select_own on public.ai_consents
  for select using (user_id = auth.uid());

create policy ai_consents_insert_self on public.ai_consents
  for insert with check (user_id = auth.uid());

create policy ai_consents_update_own on public.ai_consents
  for update using (user_id = auth.uid());

-- ------------------------------- ai_sessions --------------------------------
create policy ai_sessions_select_own on public.ai_sessions
  for select using (user_id = auth.uid());

create policy ai_sessions_insert_self on public.ai_sessions
  for insert with check (user_id = auth.uid());

create policy ai_sessions_update_own on public.ai_sessions
  for update using (user_id = auth.uid());

-- ------------------------------- ai_session_messages ------------------------
create policy ai_messages_select_own on public.ai_session_messages
  for select using (
    exists (
      select 1 from public.ai_sessions s
      where s.id = ai_session_messages.session_id
        and s.user_id = auth.uid()
    )
  );

create policy ai_messages_insert_own on public.ai_session_messages
  for insert with check (
    exists (
      select 1 from public.ai_sessions s
      where s.id = ai_session_messages.session_id
        and s.user_id = auth.uid()
    )
  );

-- ------------------------------- audit_logs ---------------------------------
-- Lecture seule pour le propriétaire ; insert seulement par lui ;
-- update et delete REVOKED ci-dessus (audit immuable).
create policy audit_select_own on public.audit_logs
  for select using (user_id = auth.uid());

create policy audit_insert_self on public.audit_logs
  for insert with check (user_id = auth.uid());

-- ------------------------------- rgpd_requests ------------------------------
create policy rgpd_select_own on public.rgpd_requests
  for select using (user_id = auth.uid());

create policy rgpd_insert_self on public.rgpd_requests
  for insert with check (user_id = auth.uid());

-- =============================================================================
-- Permissions par défaut (rôles Supabase)
-- =============================================================================
-- Supabase utilise 3 rôles principaux :
--   * anon          : utilisateurs non connectés (public)
--   * authenticated : utilisateurs connectés (passent par la RLS)
--   * service_role  : Edge Functions (bypass RLS, utiliser avec parcimonie)
--
-- On s'assure que `anon` n'a accès à rien, et `authenticated` opère via RLS.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Privilèges par défaut : s'appliquent automatiquement aux objets créés par
-- les futures migrations (sinon il faudrait re-grant à chaque migration).
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;

-- =============================================================================
-- Bootstrap : trigger qui crée un profile à chaque nouveau user auth
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Bootstrap : auto-créer la membership 'parent' pour le créateur d'un family_group
-- =============================================================================
-- Sans ce trigger, le créateur ne peut PAS insérer sa première membership :
-- la policy memberships_insert_parent exige is_family_parent(...) = true,
-- qui dépend d'une membership 'parent' déjà acceptée — chicken-and-egg.
-- security definer pour bypasser la RLS lors de l'insertion bootstrap.
create or replace function public.handle_new_family_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_memberships (family_group_id, user_id, role, accepted_at)
  values (new.id, new.owner_user_id, 'parent', now())
  on conflict (family_group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger trg_on_family_group_created
  after insert on public.family_groups
  for each row execute function public.handle_new_family_group();

-- =============================================================================
-- Catégories système (graine commune à tous les users, RLS les exposera en lecture)
-- =============================================================================
insert into public.categories (id, owner_user_id, name, icon, color, kind) values
  (gen_random_uuid(), null, 'Courses',    'shopping-cart', '#C05C2A', 'expense'),
  (gen_random_uuid(), null, 'Transport',  'car',           '#8B6C52', 'expense'),
  (gen_random_uuid(), null, 'École',      'school',        '#B8963E', 'expense'),
  (gen_random_uuid(), null, 'Loisirs',    'music',         '#6B5B8A', 'expense'),
  (gen_random_uuid(), null, 'Santé',      'heart-pulse',   '#A08060', 'expense'),
  (gen_random_uuid(), null, 'Maison',     'home',          '#3A7D44', 'expense'),
  (gen_random_uuid(), null, 'Autre',      'circle-dot',    '#D6C5B0', 'expense'),
  (gen_random_uuid(), null, 'Salaire',    'wallet',        '#3A7D44', 'income'),
  (gen_random_uuid(), null, 'Prime',      'gift',          '#3A7D44', 'income'),
  (gen_random_uuid(), null, 'Virement',   'arrows-left-right', '#8B6C52', 'transfer');
