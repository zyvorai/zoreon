-- Agora messaging workspace (Mattermost-class ops chat).
-- Shared team tables — auth is off; rows are world-readable/writable for the demo.

create table if not exists agora_meta (
  key text primary key,
  value text not null
);

create table if not exists agora_profiles (
  id text primary key,
  name text not null,
  handle text not null,
  role text not null,
  presence text not null,
  initials text not null,
  tone text not null
);

create table if not exists agora_channels (
  id text primary key,
  kind text not null,
  name text not null,
  topic text not null,
  unread integer not null default 0,
  mention boolean not null default false,
  pinned boolean not null default false,
  wave_id text,
  member_ids text not null
);

create table if not exists agora_waves (
  id text primary key,
  name text not null,
  cluster text not null,
  window_start bigint not null,
  window_end bigint not null,
  first_boot double precision not null,
  vms integer not null
);

create table if not exists agora_wave_items (
  id text primary key,
  wave_id text not null references agora_waves (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  owner text not null,
  sort_order integer not null default 0
);

create table if not exists agora_messages (
  id text primary key,
  channel_id text not null references agora_channels (id) on delete cascade,
  author_id text not null,
  body text not null,
  created_at bigint not null,
  parent_id text,
  system boolean not null default false,
  reply_count integer not null default 0
);

create index if not exists agora_messages_channel_created_idx
  on agora_messages (channel_id, created_at);

create index if not exists agora_messages_parent_idx
  on agora_messages (parent_id);

create table if not exists agora_reactions (
  message_id text not null references agora_messages (id) on delete cascade,
  reaction_id text not null,
  label text not null,
  user_id text not null,
  primary key (message_id, reaction_id, user_id)
);
