-- Stars, bookmarks, reminders, notif prefs, preferred team, post authorship overlay.

create table if not exists agora_starred_channels (
  user_email text not null,
  channel_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_email, channel_id)
);

create table if not exists agora_bookmarks (
  id text primary key,
  user_email text not null,
  message_id text not null,
  channel_id text not null,
  snippet text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists agora_bookmarks_user_idx on agora_bookmarks (user_email, created_at desc);

create table if not exists agora_reminders (
  id text primary key,
  user_email text not null,
  message_id text not null,
  channel_id text not null,
  snippet text not null default '',
  remind_at bigint not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists agora_reminders_due_idx
  on agora_reminders (user_email, remind_at)
  where done = false;

create table if not exists agora_notif_prefs (
  user_email text primary key,
  desktop boolean not null default true,
  mentions_only boolean not null default false,
  mute_dms boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists agora_user_prefs (
  user_email text primary key,
  preferred_team_id text,
  updated_at timestamptz not null default now()
);

create table if not exists agora_post_overlays (
  message_id text primary key,
  author_email text not null,
  author_name text not null,
  created_at timestamptz not null default now()
);
