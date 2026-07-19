-- 0004 — Session 11 backend bits.
--
-- 1) server_time(): lets the checker app stamp the server clock at roster
--    download and warn when the device clock is off by more than 30s
--    (offline pass-expiry checks depend on the device clock).
-- 2) Dynamic-QR TTL default moves 150s → 600s (owner decision 2026-07-19).
--    Only rows still at the old default are touched — an admin-tuned value
--    stays as-is.

create or replace function server_time()
returns timestamptz
language sql
stable
as $$ select now() $$;

grant execute on function server_time() to authenticated;

update settings
  set value = to_jsonb(600)
  where key = 'qr_pass_ttl_seconds'
    and value in (to_jsonb(150), to_jsonb('150'::text));

-- Fresh databases seed the new default directly.
insert into settings (key, value)
  values ('qr_pass_ttl_seconds', to_jsonb(600))
  on conflict (key) do nothing;
