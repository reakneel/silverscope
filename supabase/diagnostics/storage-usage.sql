-- SilverScope database size report. Run in Supabase SQL Editor (read-only).
select
  current_database() as database_name,
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_database_size(current_database()) as database_size_bytes;

select
  schemaname,
  relname as table_name,
  n_live_tup as estimated_live_rows,
  pg_size_pretty(pg_relation_size(relid)) as table_data,
  pg_size_pretty(pg_indexes_size(relid)) as indexes,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  pg_total_relation_size(relid) as total_size_bytes,
  last_analyze,
  last_autoanalyze
from pg_stat_user_tables
order by pg_total_relation_size(relid) desc
limit 30;

-- This reports table/index storage only. Supabase Storage object bytes are billed separately.
