-- Private source-file bucket for portfolio imports.
-- Upload/download is performed by authenticated server routes using service_role;
-- no direct anon/authenticated object policies are created.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio-source-files',
  'portfolio-source-files',
  false,
  10485760,
  array['text/csv','text/plain','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object RLS remains deny-by-default for anon/authenticated.
-- The server-side service_role is the only actor allowed to persist original files.
