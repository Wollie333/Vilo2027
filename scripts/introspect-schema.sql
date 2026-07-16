-- Emits the ENTIRE live public schema as one JSON document.
-- Consumed by scripts/generate-schema-doc.mjs to write docs/SCHEMA.md.
-- Never hand-edit the output — regenerate it. See docs/SCHEMA.md header.
SELECT jsonb_build_object(
  'database', current_database(),
  'tables', (
    SELECT jsonb_agg(t ORDER BY t->>'name')
    FROM (
      SELECT jsonb_build_object(
        'name', c.relname,
        'rls', c.relrowsecurity,
        'columns', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', a.attname,
            'type', format_type(a.atttypid, a.atttypmod),
            'notnull', a.attnotnull,
            'default', pg_get_expr(ad.adbin, ad.adrelid)
          ) ORDER BY a.attnum)
          FROM pg_attribute a
          LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
          WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        ),
        'pk', (
          SELECT jsonb_agg(pg_get_constraintdef(co.oid))
          FROM pg_constraint co WHERE co.conrelid = c.oid AND co.contype = 'p'
        ),
        'fks', (
          SELECT jsonb_agg(pg_get_constraintdef(co.oid) ORDER BY co.conname)
          FROM pg_constraint co WHERE co.conrelid = c.oid AND co.contype = 'f'
        ),
        'uniques', (
          SELECT jsonb_agg(pg_get_constraintdef(co.oid) ORDER BY co.conname)
          FROM pg_constraint co WHERE co.conrelid = c.oid AND co.contype = 'u'
        ),
        'checks', (
          SELECT jsonb_agg(pg_get_constraintdef(co.oid) ORDER BY co.conname)
          FROM pg_constraint co WHERE co.conrelid = c.oid AND co.contype = 'c'
        ),
        'policies', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', p.polname,
            'cmd', p.polcmd,
            'using', pg_get_expr(p.polqual, p.polrelid),
            'check', pg_get_expr(p.polwithcheck, p.polrelid)
          ) ORDER BY p.polname)
          FROM pg_policy p WHERE p.polrelid = c.oid
        ),
        'triggers', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', tg.tgname,
            'fn', pr.proname,
            'secdef', pr.prosecdef
          ) ORDER BY tg.tgname)
          FROM pg_trigger tg
          JOIN pg_proc pr ON pr.oid = tg.tgfoid
          WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal
        )
      ) AS t
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
    ) s
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'returns', pg_get_function_result(p.oid),
      'args', pg_get_function_arguments(p.oid),
      'secdef', p.prosecdef,
      'config', p.proconfig,
      'trigger', p.prorettype = 'trigger'::regtype,
      'anon_exec', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authed_exec', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'src', p.prosrc
    ) ORDER BY p.proname)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  ),
  'crons', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', j.jobname,
      'schedule', j.schedule,
      'active', j.active,
      'vault_gated', j.command LIKE '%vault.decrypted_secrets%',
      'command', j.command
    ) ORDER BY j.jobname)
    FROM cron.job j
  ),
  'vault_secret_names', (
    SELECT jsonb_agg(name ORDER BY name) FROM vault.secrets
  )
) AS doc;
