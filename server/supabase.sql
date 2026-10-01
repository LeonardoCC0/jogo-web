-- Execute uma vez no SQL Editor do projeto Supabase.
-- O servidor importa server/data/db.json somente se esta tabela estiver vazia.
begin;
create table if not exists public.cyber_slots_state (
    id integer primary key check (id = 1),
    version uuid not null,
    data jsonb not null
);
alter table public.cyber_slots_state enable row level security;
revoke all on table public.cyber_slots_state from public, anon, authenticated;
grant select, insert, update on table public.cyber_slots_state to service_role;
commit;
