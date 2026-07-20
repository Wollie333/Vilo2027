-- Fix: hosts could not submit a quote — "Could not assign a quote number".
--
-- The quote-submit server action (dashboard/quotes/actions.ts) calls
-- next_quote_number() through the USER's Supabase client, i.e. as the
-- `authenticated` role. The wiring-audit hardening revoked EXECUTE from PUBLIC on
-- these functions; because PUBLIC includes `authenticated`, that silently stripped
-- signed-in hosts' access, so the RPC failed with 42501 (permission denied) and
-- the action returned "Could not assign a quote number." (The public listing-
-- enquiry path was unaffected — it calls the same RPC via the service-role admin
-- client, which retained EXECUTE.)
--
-- The function is SECURITY DEFINER and returns only a 'Q-NNNN' string from a global
-- sequence — no sensitive data, and a burned sequence value is harmless (quote
-- numbers only need to be unique; gaps are fine). So `authenticated` may execute it.
-- anon deliberately stays WITHOUT it (no signed-out caller needs a quote number;
-- the public path uses service_role).

GRANT EXECUTE ON FUNCTION public.next_quote_number(uuid) TO authenticated;
