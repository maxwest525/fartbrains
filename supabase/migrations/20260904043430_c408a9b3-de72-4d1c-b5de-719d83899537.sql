REVOKE ALL ON FUNCTION public.revoke_shares_on_trash() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_shares_on_trash() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_shares_on_trash() TO service_role;