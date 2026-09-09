-- Message edit + pin metadata (SQL fallback).

alter table agora_messages
  add column if not exists updated_at bigint;

alter table agora_messages
  add column if not exists pinned_at bigint;

create index if not exists agora_messages_pinned_idx
  on agora_messages (channel_id, pinned_at)
  where pinned_at is not null;
