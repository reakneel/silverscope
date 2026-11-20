-- Mark the public CFTC source as a public API source; activation remains ingestion-driven.
update public.data_sources
set license_status='public_api', expected_cadence='weekly', updated_at=now()
where id='cftc';
