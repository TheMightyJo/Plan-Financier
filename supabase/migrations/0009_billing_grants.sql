-- 0009 — Droits d'accès manquants sur subscriptions / ai_usage
-- ---------------------------------------------------------------------------
-- La migration 0007 créait les tables et leurs policies RLS mais sans les
-- GRANTs explicites (le projet n'accorde rien par défaut à `authenticated`,
-- cf. 0003/0005). Sans ces droits, l'app ne peut pas lire son abonnement
-- et retombe silencieusement sur le plan gratuit. Idempotent.
-- ---------------------------------------------------------------------------

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
