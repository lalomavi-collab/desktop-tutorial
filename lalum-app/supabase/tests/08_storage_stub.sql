-- Stand in for the two Storage tables a migration may touch (buckets it creates, objects it checks). Test use only.
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (bucket_id text, name text);
alter table storage.objects add column if not exists metadata jsonb;
