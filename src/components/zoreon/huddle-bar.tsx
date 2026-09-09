import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { P2PRoom } from "@/lib/multiplayer";
import { broadcastHuddle } from "@/lib/zoreon/api";
import { useZoreon } from "@/store/use-zoreon";

const MAX_PEERS = 8;

export function HuddleBar({ channelId }: { channelId: string }) {
  const currentUserId = useZoreon((s) => s.currentUserId);
  const me = useZoreon((s) => s.users.find((u) => u.id === s.currentUserId));
  const [active, setActive] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [remotes, setRemotes] = useState<{ id: string; name: string; stream: MediaStream }[]>([]);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const roomRef = useRef<P2PRoom | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteMap = useRef(new Map<string, MediaStream>());

  const leave = () => {
    roomRef.current?.close();
    roomRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    remoteMap.current.clear();
    setRemotes([]);
    setActive(false);
    void broadcastHuddle({
      data: { channelId, participants: [] },
    }).catch(() => undefined);
  };

  const join = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      const selfId = currentUserId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "me";
      const room = `huddle-${channelId}`.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 64);
      const p2p = new P2PRoom({
        room,
        selfId,
        name: me?.name || "You",
        localStream: stream,
        onPeersChanged: (peers) => {
          if (peers.length >= MAX_PEERS) {
            setErr("Huddle is full (max 8)");
          }
          const participants = [
            { id: selfId, name: me?.name || "You" },
            ...peers.map((p) => ({ id: p.id, name: p.name })),
          ].slice(0, MAX_PEERS);
          void broadcastHuddle({ data: { channelId, participants } }).catch(() => undefined);
        },
        onRemoteTrack: (from, track, streams) => {
          const existing = remoteMap.current.get(from) ?? new MediaStream();
          existing.addTrack(track);
          if (streams[0]) {
            for (const t of streams[0].getTracks()) {
              if (!existing.getTracks().some((x) => x.id === t.id)) existing.addTrack(t);
            }
          }
          remoteMap.current.set(from, existing);
          setRemotes(
            [...remoteMap.current.entries()].map(([id, s]) => ({
              id,
              name: id,
              stream: s,
            })),
          );
        },
      });
      roomRef.current = p2p;
      await p2p.join();
      setActive(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start huddle");
      leave();
    }
  };

  useEffect(() => {
    return () => {
      roomRef.current?.close();
      roomRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      remoteMap.current.clear();
    };
  }, [channelId]);

  useEffect(() => {
    const s = streamRef.current;
    if (!s) return;
    for (const t of s.getAudioTracks()) t.enabled = audioOn;
    for (const t of s.getVideoTracks()) t.enabled = videoOn;
  }, [audioOn, videoOn]);

  if (!active) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-7 rounded-sm border border-border px-2 text-xs hover:bg-fg/10"
          onClick={() => void join()}
        >
          Huddle
        </button>
        {err ? <span className="text-xs text-danger">{err}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-elevated p-2">
      <div className="flex flex-wrap items-center gap-2">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="h-20 w-28 rounded-sm bg-desktop object-cover"
        />
        {remotes.map((r) => (
          <RemoteTile key={r.id} stream={r.stream} label={r.name} />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-sm hover:bg-fg/10"
          onClick={() => setAudioOn((v) => !v)}
          aria-label={audioOn ? "Mute" : "Unmute"}
        >
          {audioOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </button>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-sm hover:bg-fg/10"
          onClick={() => setVideoOn((v) => !v)}
          aria-label={videoOn ? "Camera off" : "Camera on"}
        >
          {videoOn ? <Video className="size-4" /> : <VideoOff className="size-4" />}
        </button>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-sm bg-danger/90 px-2 text-xs text-white"
          onClick={leave}
        >
          <PhoneOff className="size-3.5" />
          Leave
        </button>
        {err ? <span className="text-xs text-danger">{err}</span> : null}
      </div>
    </div>
  );
}

function RemoteTile({ stream, label }: { stream: MediaStream; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative">
      <video ref={ref} autoPlay playsInline className="h-20 w-28 rounded-sm bg-desktop object-cover" />
      <span className="absolute bottom-0 left-0 truncate rounded-tr-sm bg-desktop/70 px-1 text-[10px]">
        {label}
      </span>
    </div>
  );
}
