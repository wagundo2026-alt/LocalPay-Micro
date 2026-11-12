-- Security hardening applied to the connected Supabase project on 2026-11-12.
-- The event trigger helper auto-enables RLS on tables created in public.
-- It must not be callable by anonymous or signed-in API clients.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
-- The automatic table creation event trigger may still run through its
-- registered Postgres event trigger without API execute privileges.
