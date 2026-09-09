/**
 * Parse Slack-like search modifiers into Mattermost/SQL-friendly pieces.
 * Supported: from:handle, in:#channel|name, has:link|file|reaction, before:YYYY-MM-DD, after:YYYY-MM-DD
 */
export type ParsedSearch = {
  freeText: string;
  from?: string;
  inChannel?: string;
  has?: "link" | "file" | "reaction";
  before?: string;
  after?: string;
  /** Mattermost search terms string */
  mmTerms: string;
};

const MOD =
  /\b(from|in|has|before|after):([^\s]+)/gi;

export function parseSearchQuery(raw: string): ParsedSearch {
  const parts: string[] = [];
  let from: string | undefined;
  let inChannel: string | undefined;
  let has: ParsedSearch["has"];
  let before: string | undefined;
  let after: string | undefined;

  const cleaned = raw.replace(MOD, (_, key: string, val: string) => {
    const k = key.toLowerCase();
    const v = val.replace(/^#/, "");
    if (k === "from") from = v;
    else if (k === "in") inChannel = v;
    else if (k === "has" && ["link", "file", "reaction"].includes(v.toLowerCase())) {
      has = v.toLowerCase() as ParsedSearch["has"];
    } else if (k === "before") before = v;
    else if (k === "after") after = v;
    return " ";
  });

  const freeText = cleaned.replace(/\s+/g, " ").trim();
  if (freeText) parts.push(freeText);
  if (from) parts.push(`from:${from}`);
  if (inChannel) parts.push(`in:${inChannel}`);
  if (has) parts.push(`has:${has}`);
  if (before) parts.push(`before:${before}`);
  if (after) parts.push(`after:${after}`);

  return {
    freeText,
    from,
    inChannel,
    has,
    before,
    after,
    mmTerms: parts.join(" ").trim() || freeText,
  };
}
