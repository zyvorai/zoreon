-- Admin: deactivate, audit, retention, push subscriptions.

create table if not exists agora_deactivated_users (
  email text primary key,
  deactivated_at timestamptz not null default now(),
  deactivated_by text
);

create table if not exists agora_audit_log (
  id text primary key,
  at timestamptz not null default now(),
  actor_email text,
  action text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists agora_audit_log_at_idx on agora_audit_log (at desc);

create table if not exists agora_workspace_settings (
  id text primary key default 'default',
  retention_days int,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into agora_workspace_settings (id, retention_days)
values ('default', null)
on conflict (id) do nothing;

create table if not exists agora_push_subscriptions (
  id text primary key,
  user_email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists agora_push_subs_email_idx on agora_push_subscriptions (user_email);
