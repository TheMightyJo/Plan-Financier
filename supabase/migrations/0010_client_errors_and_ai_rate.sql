-- 0010 — Monitoring des erreurs client + rate limiting IA
-- ---------------------------------------------------------------------------
-- client_errors  : erreurs de production remontées par l'app (dédupliquées
--                  par empreinte, compteur d'occurrences). Écrites et lues
--                  uniquement par les fonctions Edge (service_role) ; digest
--                  quotidien par email.
-- ai_rate_limits : fenêtre glissante d'une minute par utilisateur pour la
--                  fonction ai-chat (en plus du quota mensuel).
-- ---------------------------------------------------------------------------

create table if not exists public.client_errors (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  message text not null,
  stack text,
  url text,
  user_agent text,
  build text,
  user_id uuid references auth.users (id) on delete set null,
  occurrences integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

alter table public.client_errors enable row level security;
-- Aucune policy : ni anon ni authenticated n'y accèdent, service_role seulement.
grant all on public.client_errors to service_role;

create index if not exists client_errors_last_seen_idx on public.client_errors (last_seen);
create index if not exists client_errors_first_seen_idx on public.client_errors (first_seen);

create table if not exists public.ai_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

alter table public.ai_rate_limits enable row level security;
grant all on public.ai_rate_limits to service_role;
