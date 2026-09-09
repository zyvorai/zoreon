import { useEffect, useRef } from "react";
import { MenuBar } from "@/components/desktop/menu-bar";
import { Dock } from "@/components/desktop/dock";
import { WindowFrame } from "@/components/desktop/window-frame";
import { CommandPalette } from "@/components/desktop/command-palette";
import { Workspace } from "@/components/zoreon/workspace";
import { useZoreon } from "@/store/use-zoreon";
import { pushPublicKey, registerPushSubscription } from "@/lib/zoreon/api";

export function Desktop() {
  const windowMode = useZoreon((s) => s.windowMode);
  const setWindowMode = useZoreon((s) => s.setWindowMode);
  const hydrate = useZoreon((s) => s.hydrate);
  const refresh = useZoreon((s) => s.refresh);
  const noteTyping = useZoreon((s) => s.noteTyping);
  const notifDesktop = useZoreon((s) => s.notifPrefs.desktop);
  const notifMentionsOnly = useZoreon((s) => s.notifPrefs.mentionsOnly);
  const quietStart = useZoreon((s) => s.notifPrefs.quietStart);
  const quietEnd = useZoreon((s) => s.notifPrefs.quietEnd);
  const sendMessage = useZoreon((s) => s.sendMessage);
  const queueRef = useRef<{ body: string; parentId?: string }[]>([]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const { key } = await pushPublicKey();
        if (!key || !("PushManager" in window) || !("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return;
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          });
        }
        const json = sub.toJSON();
        if (json.endpoint && json.keys?.p256dh && json.keys?.auth) {
          await registerPushSubscription({
            data: {
              endpoint: json.endpoint,
              keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
            },
          });
        }
      } catch {
        /* push optional */
      }
    })();
  }, []);

  useEffect(() => {
    const flush = () => {
      const q = queueRef.current.splice(0);
      for (const item of q) sendMessage(item.body, item.parentId);
    };
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [sendMessage]);

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource("/api/zoreon/events");
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse(msg.data) as {
            type: string;
            channelId?: string;
            userId?: string;
            userName?: string;
            at?: number;
            reason?: string;
            preview?: string;
          };
          if (ev.type === "typing" && ev.channelId && ev.userId && ev.userName) {
            noteTyping(ev.channelId, {
              userId: ev.userId,
              userName: ev.userName,
              at: ev.at ?? Date.now(),
            });
            return;
          }
          if (ev.type === "refresh" || ev.type === "huddle") {
            void refresh();
            if (
              notifDesktop &&
              !notifMentionsOnly &&
              typeof Notification !== "undefined" &&
              Notification.permission === "granted" &&
              document.visibilityState === "hidden"
            ) {
              const hour = new Date().getUTCHours();
              let quiet = false;
              if (quietStart != null && quietEnd != null && quietStart !== quietEnd) {
                quiet =
                  quietStart < quietEnd
                    ? hour >= quietStart && hour < quietEnd
                    : hour >= quietStart || hour < quietEnd;
              }
              if (!quiet) {
                try {
                  new Notification("Zoreon", {
                    body: ev.preview || "New activity in workspace",
                    silent: true,
                  });
                } catch {
                  /* */
                }
              }
            }
          }
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        window.setTimeout(connect, 4000);
      };
    };

    connect();

    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);

    return () => {
      closed = true;
      es?.close();
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, noteTyping, notifDesktop, notifMentionsOnly, quietStart, quietEnd]);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-desktop text-fg">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 18% 0%, var(--color-desktop-mist) 0%, transparent 55%), radial-gradient(900px 600px at 90% 100%, var(--color-desktop-deep) 0%, transparent 50%), var(--color-desktop)",
        }}
      />
      <MenuBar />
      <div
        className="relative flex min-h-0 flex-1 items-stretch justify-center p-0 md:items-center md:p-3 md:pb-20"
        onDoubleClick={() => {
          if (windowMode === "minimized") setWindowMode("maximized");
        }}
      >
        <WindowFrame>
          <Workspace />
        </WindowFrame>
        {windowMode === "minimized" ? (
          <p className="pointer-events-none absolute bottom-28 hidden text-sm text-fg-muted md:block">
            Zoreon is minimized
          </p>
        ) : null}
      </div>
      <Dock />
      <CommandPalette />
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
