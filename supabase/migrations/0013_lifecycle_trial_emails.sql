-- 0013 — Emails de fin d'essai (J-3 et jour J)
-- ---------------------------------------------------------------------------
-- Deux nouveaux types dans le journal idempotent lifecycle_emails, envoyés
-- par le cron quotidien de la fonction lifecycle-emails aux comptes en essai
-- (créés à partir du 1er octobre 2026, sans abonnement payant).
-- ---------------------------------------------------------------------------

alter table public.lifecycle_emails drop constraint if exists lifecycle_emails_kind_check;
alter table public.lifecycle_emails
  add constraint lifecycle_emails_kind_check
  check (kind in ('welcome', 'followup_d3', 'trial_ending', 'trial_ended'));
