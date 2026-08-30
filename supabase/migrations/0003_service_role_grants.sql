-- =============================================================================
-- Plan Financier — droits du service_role
-- Migration : 0003_service_role_grants
--
-- La migration 0001 n'accordait les droits de table qu'à `authenticated` :
-- les Edge Functions (service_role) obtenaient « permission denied » sur
-- family_groups & co. Le service_role contourne la RLS mais a quand même
-- besoin des GRANTs SQL classiques.
-- =============================================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Et pour les objets créés par les migrations futures :
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
