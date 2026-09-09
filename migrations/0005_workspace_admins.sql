-- Workspace admins (invite / regenerate). Matched by Better Auth email.

create table if not exists agora_workspace_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into agora_workspace_admins (email)
values ('ssahani@zyvor.dev')
on conflict (email) do nothing;
