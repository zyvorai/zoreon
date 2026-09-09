export type Presence = "active" | "away" | "dnd";

export type ChannelKind = "channel" | "dm" | "war-room";

export type MessagingBackend = "mattermost" | "sql";

export type User = {
  id: string;
  name: string;
  handle: string;
  role: string;
  presence: Presence;
  initials: string;
  tone: "slate" | "steel" | "navy" | "fog" | "accent";
};

export type Channel = {
  id: string;
  kind: ChannelKind;
  name: string;
  topic: string;
  unread: number;
  mention?: boolean;
  members: string[];
  pinned?: boolean;
  starred?: boolean;
  waveId?: string;
};

export type Reaction = {
  id: string;
  label: string;
  count: number;
  mine: boolean;
};

export type MessageFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
};

export type Message = {
  id: string;
  channelId: string;
  authorId: string;
  body: string;
  createdAt: number;
  updatedAt?: number;
  parentId?: string;
  replyCount?: number;
  reactions: Reaction[];
  system?: boolean;
  files?: MessageFile[];
  pinnedAt?: number;
};

export type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  owner: string;
};

export type Wave = {
  id: string;
  name: string;
  cluster: string;
  windowStart: number;
  windowEnd: number;
  firstBoot: number;
  vms: number;
  items: ChecklistItem[];
};

export type Huddle = {
  channelId: string;
  participants: string[];
  startedAt: number;
} | null;
