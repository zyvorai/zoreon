import type { Channel, Message, User, Wave } from "./types";

const hour = 60 * 60 * 1000;

/** Bump when seed shape changes so labs re-apply without manual reset. */
export const SEED_VERSION = "zoreon-v1";

export const currentUserId = "u-ssahani";

export const users: User[] = [
  {
    id: "u-ssahani",
    name: "S Sahani",
    handle: "ssahani",
    role: "Zyvor",
    presence: "active",
    initials: "SS",
    tone: "accent",
  },
  {
    id: "u-zoreon",
    name: "Zoreon",
    handle: "zoreon",
    role: "Bot",
    presence: "away",
    initials: "ZO",
    tone: "slate",
  },
];

/** Fresh cutover workspace — call at seed/reset time so windows stay live. */
export function buildSeed(now = Date.now()): {
  channels: Channel[];
  messages: Message[];
  waves: Wave[];
} {
  const waves: Wave[] = [
    {
      id: "wave-cutover",
      name: "Cutover — Axiom estate",
      cluster: "axiom-lab-1",
      windowStart: now - 20 * 60 * 1000,
      windowEnd: now + 2 * hour + 14 * 60 * 1000,
      firstBoot: 98.2,
      vms: 24,
      items: [
        { id: "c1", label: "Freeze source writes", done: true, owner: "Sahani" },
        { id: "c2", label: "GuestKit passports signed", done: true, owner: "Sahani" },
        { id: "c3", label: "Incremental sync green", done: true, owner: "Sahani" },
        { id: "c4", label: "Cutover window open", done: false, owner: "Sahani" },
        { id: "c5", label: "First-boot sample", done: false, owner: "Sahani" },
        { id: "c6", label: "Policy attach", done: false, owner: "Sahani" },
        { id: "c7", label: "DNS flip + soak", done: false, owner: "Sahani" },
      ],
    },
  ];

  const channels: Channel[] = [
    {
      id: "ch-cutover",
      kind: "war-room",
      name: "cutover",
      topic: "Axiom estate cutover · freeze in effect",
      unread: 1,
      mention: true,
      members: ["u-ssahani", "u-zoreon"],
      pinned: true,
      waveId: "wave-cutover",
    },
    {
      id: "ch-zyvor",
      kind: "channel",
      name: "zyvor",
      topic: "Zyvor · company channel",
      unread: 0,
      members: ["u-ssahani", "u-zoreon"],
    },
    {
      id: "ch-axiom",
      kind: "channel",
      name: "axiom",
      topic: "Axiom private cloud · day-2 ops",
      unread: 0,
      members: ["u-ssahani", "u-zoreon"],
    },
    {
      id: "ch-zoreon",
      kind: "channel",
      name: "zoreon",
      topic: "Ops chat product · Mattermost is the tape",
      unread: 0,
      members: ["u-ssahani", "u-zoreon"],
    },
    {
      id: "ch-ragnarok",
      kind: "channel",
      name: "ragnarok",
      topic: "Confidential compute · attestation",
      unread: 0,
      members: ["u-ssahani", "u-zoreon"],
    },
  ];

  const messages: Message[] = [
    {
      id: "m1",
      channelId: "ch-cutover",
      authorId: "u-zoreon",
      body: "War room opened for Axiom estate cutover. Window is live — post status here.",
      createdAt: now - 3 * hour,
      reactions: [],
      system: true,
    },
    {
      id: "m2",
      channelId: "ch-cutover",
      authorId: "u-ssahani",
      body: "Freeze held. Incremental sync green. We go on the planned window — abort to snapshot if first-boot sample fails twice.",
      createdAt: now - 18 * 60 * 1000,
      reactions: [{ id: "ack", label: "Ack", count: 1, mine: true }],
    },
    {
      id: "m3",
      channelId: "ch-zyvor",
      authorId: "u-zoreon",
      body: "Welcome to #zyvor. This is the company channel for Zyvor ops.",
      createdAt: now - 8 * hour,
      reactions: [],
      system: true,
    },
    {
      id: "m4",
      channelId: "ch-zyvor",
      authorId: "u-ssahani",
      body: "ssahani@zyvor.dev online. Mattermost stays as tape; Zoreon is the product for cutover.",
      createdAt: now - 2 * hour,
      reactions: [],
    },
    {
      id: "m5",
      channelId: "ch-axiom",
      authorId: "u-zoreon",
      body: "Axiom control plane channel. Cluster health, day-2, and console notes land here.",
      createdAt: now - 7 * hour,
      reactions: [],
      system: true,
    },
    {
      id: "m6",
      channelId: "ch-zoreon",
      authorId: "u-zoreon",
      body: "Zoreon product channel — war rooms, threads, and huddles on-estate.",
      createdAt: now - 6 * hour,
      reactions: [],
      system: true,
    },
    {
      id: "m7",
      channelId: "ch-ragnarok",
      authorId: "u-zoreon",
      body: "Ragnarok attests; Axiom operates. Use this channel for confidential-compute cutover notes.",
      createdAt: now - 5 * hour,
      reactions: [],
      system: true,
    },
  ];

  return { channels, messages, waves };
}

const initial = buildSeed();
export const channels = initial.channels;
export const messages = initial.messages;
export const waves = initial.waves;
