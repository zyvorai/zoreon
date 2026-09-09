-- Workspace invite tokens (multi-use until regenerated).

create table if not exists agora_invites (
  token text primary key,
  created_by text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  use_count integer not null default 0
);

create index if not exists agora_invites_active_idx
  on agora_invites (created_at desc)
  where revoked_at is null;
