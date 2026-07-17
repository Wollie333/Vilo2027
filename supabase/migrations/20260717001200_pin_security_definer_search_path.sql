-- Pin search_path on every SECURITY DEFINER function in `public` that lacks one.
--
-- An SD function runs as its OWNER but resolves unqualified object names via the
-- CALLER's search_path. A caller who can create an object earlier in that path
-- could shadow one the function trusts and have it run as owner — privilege
-- escalation. Untrusted roles can't CREATE in public today (anon/authenticated
-- both lack it), so this is defense in depth; it also clears the standing red
-- flag that generate-schema-doc.mjs re-checks on every run.
--
-- Safe to pin to `public, pg_temp`: verified no SD function references pgcrypto
-- or uuid-ossp (the `extensions` schema) unqualified, and every auth./vault./
-- net./cron. call is schema-qualified. So nothing needs a schema beyond public
-- on the path — behaviour is preserved.
--
-- Done as a set-based sweep (by exact signature, so overloads are covered) rather
-- than 75 hand-written ALTERs; idempotent — a re-run finds nothing left.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c
        WHERE c LIKE 'search_path=%'
      )
      -- Skip functions owned by an extension (PostGIS et al. install SD
      -- functions into public that we neither own nor should alter).
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
