// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

import type { VerifiedUser } from "@/lib/auth/verify.server";
import { type ExportRequest } from "./timeline-request";
import { renderExport } from "./timeline-insights";
import { buildTimeline, type TimelineAuthor, type TimelineMessage } from "./timeline-export";

function safeFilePart(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 40) || "channel";
}

export async function runTimelineExport(req: ExportRequest, session: VerifiedUser | null) {
  const { isMattermostMessagingEnabled, loadChannelForExportMattermost } =
    await import("./mattermost-workspace.server");
  let channelName: string;
  let messages: TimelineMessage[];
  let authors: Record<string, TimelineAuthor> = {};

  if (isMattermostMessagingEnabled()) {
    const r = await loadChannelForExportMattermost(req.channelId, session);
    channelName = r.channelName;
    messages = r.messages;
    authors = r.authors;
  } else {
    const { ensureWorkspaceSeeded } = await import("./workspace.server");
    const { getSql } = await import("@/lib/db");
    await ensureWorkspaceSeeded();
    const sql = await getSql();
    const ch = await sql<{ name: string; kind: string; member_ids: string }>`
      select name, kind, member_ids from agora_channels where id = ${req.channelId}
    `;
    if (!ch[0]) throw new Error("Channel not found");
    if (ch[0].kind === "dm") {
      if (!session) throw new Error("Unauthorized");
      const { ensureProfileForSession } = await import("./workspace.server");
      const me = await ensureProfileForSession(session);
      const members = JSON.parse(ch[0].member_ids) as string[];
      if (!members.includes(me)) throw new Error("Not a member of this channel");
    }
    channelName = ch[0].name;
    // Parameterised: channel id and bounds are bound values, never interpolated.
    const rows = await sql<{
      id: string;
      author_id: string;
      body: string;
      created_at: number;
      parent_id: string | null;
      system: boolean;
    }>`
      select id, author_id, body, created_at, parent_id, system
      from agora_messages
      where channel_id = ${req.channelId}
        and created_at >= ${req.since ?? 0}
        and created_at <= ${req.until ?? Number.MAX_SAFE_INTEGER}
      order by created_at asc
      limit 5001
    `;
    messages = rows.map((r) => ({
      id: r.id,
      authorId: r.author_id,
      body: r.body,
      createdAt: Number(r.created_at),
      parentId: r.parent_id ?? undefined,
      system: r.system,
    }));
    const profiles = await sql<{ id: string; name: string; handle: string }>`
      select id, name, handle from agora_profiles
    `;
    for (const p of profiles) authors[p.id] = { name: p.name, handle: p.handle };
  }

  const timeline = buildTimeline(messages, {
    channelName,
    since: req.since,
    until: req.until,
    authors,
  });
  const rendered = renderExport(timeline, req.format, req.highlightsOnly);
  const { writeAudit } = await import("./admin.server");
  await writeAudit({
    actorEmail: session?.email,
    action: "timeline.export",
    meta: {
      channelId: req.channelId,
      format: req.format,
      highlightsOnly: req.highlightsOnly,
      entries: timeline.entries.length,
      truncated: timeline.truncated,
    },
  });
  return {
    filename: `${req.format === "retro" ? "review" : "timeline"}-${safeFilePart(channelName)}.${rendered.ext}`,
    mime: rendered.mime,
    content: rendered.content,
    entries: rendered.entries,
    truncated: timeline.truncated,
  };
}
