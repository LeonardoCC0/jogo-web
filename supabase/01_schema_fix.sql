-- AJUSTE DO ESQUEMA PARA O FORMATO REAL DO PROJETO
-- Execute este bloco ANTES do bloco de importação dos dados.

-- O projeto atual usa IDs como u_88ed6754, então os IDs precisam ser TEXT.
alter table public.admin_logs drop constraint if exists admin_logs_admin_id_fkey;
alter table public.admin_logs drop constraint if exists admin_logs_target_user_id_fkey;
alter table public.history drop constraint if exists history_user_id_fkey;
alter table public.sessions drop constraint if exists sessions_user_id_fkey;

alter table public.users alter column id type text using id::text;
alter table public.sessions alter column user_id type text using user_id::text;
alter table public.history alter column user_id type text using user_id::text;
alter table public.admin_logs alter column admin_id type text using admin_id::text;
alter table public.admin_logs alter column target_user_id type text using target_user_id::text;

-- Sessões: o backend precisa validar o token recebido pelo navegador.
alter table public.sessions add column if not exists token text;

-- O projeto usa a role "banned" internamente.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('user', 'admin', 'founder', 'banned'));

-- O token em texto fica protegido porque estas tabelas têm RLS e só o backend
-- usa a secret key do Supabase.
create unique index if not exists idx_sessions_token_unique on public.sessions(token);

-- Restaura as relações para manter integridade referencial.
alter table public.sessions
  add constraint sessions_user_id_fkey
  foreign key (user_id) references public.users(id) on delete cascade;

alter table public.history
  add constraint history_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

alter table public.admin_logs
  add constraint admin_logs_admin_id_fkey
  foreign key (admin_id) references public.users(id) on delete set null;

alter table public.admin_logs
  add constraint admin_logs_target_user_id_fkey
  foreign key (target_user_id) references public.users(id) on delete set null;
