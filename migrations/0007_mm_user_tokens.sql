-- Per-user Mattermost access tokens (encrypted at app layer).

create table if not exists agora_mm_tokens (
  user_id text primary key,
  mm_user_id text not null,
  token_cipher text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agora_mm_tokens_mm_user_idx on agora_mm_tokens (mm_user_id);
