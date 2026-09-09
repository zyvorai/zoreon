create table if not exists agora_saved_searches (
  id text primary key,
  user_email text not null,
  name text not null,
  query text not null,
  created_at timestamptz not null default now()
);

create index if not exists agora_saved_searches_user_idx
  on agora_saved_searches (user_email, created_at desc);
