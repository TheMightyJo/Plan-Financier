-- =============================================================================
-- Plan Financier — options de rapport par email
-- Migration : 0006_report_options
--
-- Étend report_preferences (migration 0005) :
--   - attachment : pièce jointe générée par send-report ('none' = email seul,
--     'csv', 'excel' ou 'pdf').
--   - cc_emails  : adresses mises en copie des rapports automatiques (max 5,
--     validées côté client ; la fonction re-filtre par sécurité).
-- =============================================================================

alter table public.report_preferences
  add column attachment text not null default 'none'
    check (attachment in ('none', 'csv', 'excel', 'pdf')),
  add column cc_emails text[] not null default '{}'
    check (array_length(cc_emails, 1) is null or array_length(cc_emails, 1) <= 5);
