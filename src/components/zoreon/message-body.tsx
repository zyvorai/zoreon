import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Safe subset: escapes HTML, then applies limited markdown + @mentions + autolinks. */
export function MessageBody({ body, myHandle }: { body: string; myHandle?: string }) {
  const nodes = renderMessage(body, myHandle);
  return <div className="text-sm leading-normal text-fg whitespace-pre-wrap break-words">{nodes}</div>;
}

function renderMessage(raw: string, myHandle?: string): ReactNode[] {
  const lines = raw.split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    if (line.startsWith("```")) {
      const fence: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        fence.push(lines[i]!);
        i += 1;
      }
      i += 1;
      out.push(
        <pre
          key={`c-${key++}`}
          className="my-1 overflow-x-auto rounded-sm bg-elevated px-2 py-1.5 font-mono text-xs"
        >
          {fence.join("\n")}
        </pre>,
      );
      continue;
    }
    if (/^[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^[-*] /, ""));
        i += 1;
      }
      out.push(
        <ul key={`ul-${key++}`} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((item, j) => (
            <li key={j}>{inline(item, myHandle, `li-${key}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    out.push(
      <p key={`p-${key++}`} className={i < lines.length - 1 ? "mb-0" : undefined}>
        {inline(line, myHandle, `p-${key}`)}
        {i < lines.length - 1 ? "\n" : null}
      </p>,
    );
    i += 1;
  }
  return out;
}

function inline(text: string, myHandle: string | undefined, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Split on code, bold, italic, links, mentions — single pass tokenizer
  const re =
    /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(https?:\/\/[^\s<]+)|(@[A-Za-z0-9._-]+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("`")) {
      parts.push(
        <code key={`${keyPrefix}-c${k++}`} className="rounded-sm bg-elevated px-1 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keyPrefix}-b${k++}`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("*")) {
      parts.push(
        <em key={`${keyPrefix}-i${k++}`} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    } else if (token.startsWith("http")) {
      parts.push(
        <a
          key={`${keyPrefix}-a${k++}`}
          href={token}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent underline-offset-2 hover:underline"
        >
          {token}
        </a>,
      );
    } else if (token.startsWith("@")) {
      const handle = token.slice(1);
      const mine = myHandle && handle.toLowerCase() === myHandle.toLowerCase();
      parts.push(
        <span
          key={`${keyPrefix}-m${k++}`}
          className={cn("rounded-sm px-0.5 font-medium", mine ? "bg-accent/25 text-accent" : "text-accent")}
        >
          {token}
        </span>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
