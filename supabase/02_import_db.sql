-- IMPORTAÇÃO DOS DADOS EXISTENTES DO db.json
-- As sessões antigas são invalidadas de propósito; todos deverão fazer login novamente.

delete from public.sessions;

insert into public.users
(id, username, display_name, email, password_hash, salt, google_id, avatar, balance, highest_win, score, role, is_banned, ban_reason, banned_at, created_at, updated_at)
values ('u_88ed6754','coxstaa','coxstaa',NULL,'7bb6c366f7025e42b99b093acdda8eb6a56c23e57d59086cccc2d59672d70f56f0c6d5f316be010c46e3019b5ca52be2176a2e67f7b1e4f65291bdb8609069cf','5b8891979bb12b816ceac9cbef23c02c',NULL,'🥷',99998250,750,99998250,'user',false,NULL,NULL,to_timestamp(1790166621057 / 1000.0),to_timestamp(1790772038584 / 1000.0))
on conflict (id) do update set
 username=excluded.username, display_name=excluded.display_name, email=excluded.email,
 password_hash=excluded.password_hash, salt=excluded.salt, google_id=excluded.google_id,
 avatar=excluded.avatar, balance=excluded.balance, highest_win=excluded.highest_win,
 score=excluded.score, role=excluded.role, is_banned=excluded.is_banned,
 ban_reason=excluded.ban_reason, banned_at=excluded.banned_at,
 created_at=excluded.created_at, updated_at=excluded.updated_at;
insert into public.users
(id, username, display_name, email, password_hash, salt, google_id, avatar, balance, highest_win, score, role, is_banned, ban_reason, banned_at, created_at, updated_at)
values ('u_g_291e0b5f','leonardodeca','Leonardo de Carv','47131@raphaeldisanto.com.br',NULL,NULL,'111490073636661317627','https://lh3.googleusercontent.com/a/ACg8ocI1xh6e7ijEd18s2v71Ncq5fUlswMJ_y5dlH38pejEfGkQ4elk=s96-c',999499,6250,999499,'founder',false,NULL,NULL,to_timestamp(1790769507802 / 1000.0),to_timestamp(1790772049592 / 1000.0))
on conflict (id) do update set
 username=excluded.username, display_name=excluded.display_name, email=excluded.email,
 password_hash=excluded.password_hash, salt=excluded.salt, google_id=excluded.google_id,
 avatar=excluded.avatar, balance=excluded.balance, highest_win=excluded.highest_win,
 score=excluded.score, role=excluded.role, is_banned=excluded.is_banned,
 ban_reason=excluded.ban_reason, banned_at=excluded.banned_at,
 created_at=excluded.created_at, updated_at=excluded.updated_at;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_4934917f','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','balance_change','u_88ed6754','coxstaa','{"saldoAnterior": 775, "saldoNovo": 100000000, "diferenca": 99999225, "motivo": "lindo"}'::jsonb,to_timestamp(1790771970969 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_ad85d82b','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','user_unbanned','u_88ed6754','coxstaa','{"motivo": "Desbanimento administrativo"}'::jsonb,to_timestamp(1790771934395 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_e05ebd24','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','user_banned','u_88ed6754','coxstaa','{"motivo": "Banimento para teste"}'::jsonb,to_timestamp(1790771934392 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_0797223d','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','balance_change','u_88ed6754','coxstaa','{"saldoAnterior": 1275, "saldoNovo": 775, "diferenca": -500, "motivo": "Revertendo teste"}'::jsonb,to_timestamp(1790771934388 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_7d9e6ea4','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','user_unbanned','u_88ed6754','coxstaa','{"motivo": "Desbanimento administrativo"}'::jsonb,to_timestamp(1790771934385 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_d8570a81','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','user_banned','u_88ed6754','coxstaa','{"motivo": "Teste de banimento"}'::jsonb,to_timestamp(1790771934380 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_d95b380e','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','balance_change','u_88ed6754','coxstaa','{"saldoAnterior": 775, "saldoNovo": 1275, "diferenca": 500, "motivo": "Teste de auditoria"}'::jsonb,to_timestamp(1790771934378 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_f04587f4','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','admin_demoted','u_88ed6754','coxstaa','{"motivo": "Privilégio de Administrador revogado pelo Fundador"}'::jsonb,to_timestamp(1790771934375 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_b6ee758a','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','admin_promoted','u_88ed6754','coxstaa','{"motivo": "Promovido a Administrador pelo Fundador"}'::jsonb,to_timestamp(1790771934372 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_e7cc4f75','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','admin_demoted','u_88ed6754','coxstaa','{"motivo": "Privilégio de Administrador revogado pelo Fundador"}'::jsonb,to_timestamp(1790771934369 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_b863dea9','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','admin_promoted','u_88ed6754','coxstaa','{"motivo": "Promovido a Administrador pelo Fundador"}'::jsonb,to_timestamp(1790771934364 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
insert into public.admin_logs
(id, admin_id, admin_email, admin_username, action, target_user_id, target_username, details, timestamp)
values ('log_1db9f4c1','u_g_291e0b5f','47131@raphaeldisanto.com.br','Leonardo de Carv','balance_change','u_g_291e0b5f','Leonardo de Carv','{"saldoAnterior": 500, "saldoNovo": 999999, "diferenca": 999499, "motivo": "teste"}'::jsonb,to_timestamp(1790771934361 / 1000.0))
on conflict (id) do update set
 admin_id=excluded.admin_id, admin_email=excluded.admin_email, admin_username=excluded.admin_username,
 action=excluded.action, target_user_id=excluded.target_user_id, target_username=excluded.target_username,
 details=excluded.details, timestamp=excluded.timestamp;
update public.game_stats set total_spins = 120 where id = 1;
