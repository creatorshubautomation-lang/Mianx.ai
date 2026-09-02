-- Mianx.ai V3 — lock down the RLS infrastructure helper.
-- The function must remain callable by database/service roles only.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
