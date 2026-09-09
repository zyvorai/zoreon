-- Channel mute / notify levels, keyword alerts, quiet hours.

alter table agora_notif_prefs
  add column if not exists quiet_start int,
  add column if not exists quiet_end int;

create table if not exists agora_channel_prefs (
  user_email text not null,
  channel_id text not null,
  muted boolean not null default false,
  mute_until bigint,
  notify_level text not null default 'all',
  updated_at timestamptz not null default now(),
  primary key (user_email, channel_id)
);

create table if not exists agora_keyword_alerts (
  user_email text not null,
  keyword text not null,
  created_at timestamptz not null default now(),
  primary key (user_email, keyword)
);
