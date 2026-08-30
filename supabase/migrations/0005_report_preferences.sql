-- =============================================================================
-- Plan Financier — rapports par email
-- Migration : 0005_report_preferences
--
-- Préférences d'envoi du rapport automatique (fréquence + contenu). L'envoi
-- lui-même est réalisé par l'Edge Function `send-report` (cron quotidien qui
-- détecte les rapports « dus » via last_sent_at).
-- =============================================================================

create table public.report_preferences (
  user_id      uuid primary key references public.profiles(user_id) on delete cascade,
  frequency    text not null default 'none' check (frequency in ('none', 'weekly', 'monthly')),
  format       text not null default 'summary' check (format in ('summary', 'detailed')),
  last_sent_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_report_prefs_updated_at
  before update on public.report_preferences
  for each row execute function public.touch_updated_at();

alter table public.report_preferences enable row level security;

create policy report_prefs_select_own on public.report_preferences
  for select using (user_id = auth.uid());

create policy report_prefs_insert_self on public.report_preferences
  for insert with check (user_id = auth.uid());

create policy report_prefs_update_own on public.report_preferences
  for update using (user_id = auth.uid());

grant select, insert, update, delete on public.report_preferences to authenticated;
grant all on public.report_preferences to service_role;
