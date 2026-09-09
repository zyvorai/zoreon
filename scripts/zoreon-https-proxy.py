#!/usr/bin/env python3
"""HTTPS reverse proxy for Zoreon lab deploys (TLS → local HTTP app)."""
from __future__ import annotations

import argparse
import http.client
import http.server
import ssl
import sys


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    upstream_host = "127.0.0.1"
    upstream_port = 13091

    def log_message(self, fmt: str, *args) -> None:  # quieter journals
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or 0)
        body = self.rfile.read(length) if length else None
        conn = http.client.HTTPConnection(self.upstream_host, self.upstream_port, timeout=120)
        try:
            headers = {k: v for k, v in self.headers.items() if k.lower() != "host"}
            headers["Host"] = f"{self.upstream_host}:{self.upstream_port}"
            # Preserve original host for Better Auth / absolute redirects when present.
            if "X-Forwarded-Host" not in headers and "Host" in self.headers:
                headers["X-Forwarded-Host"] = self.headers["Host"]
            headers["X-Forwarded-Proto"] = "https"
            conn.request(self.command, self.path, body=body, headers=headers)
            resp = conn.getresponse()
            payload = resp.read()
            self.send_response(resp.status, resp.reason)
            for key, val in resp.getheaders():
                if key.lower() in {"transfer-encoding", "connection"}:
                    continue
                self.send_header(key, val)
            self.end_headers()
            if payload and self.command != "HEAD":
                self.wfile.write(payload)
        finally:
            conn.close()

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()

    def do_PUT(self) -> None:
        self._proxy()

    def do_PATCH(self) -> None:
        self._proxy()

    def do_DELETE(self) -> None:
        self._proxy()

    def do_OPTIONS(self) -> None:
        self._proxy()

    def do_HEAD(self) -> None:
        self._proxy()


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--listen", default="0.0.0.0")
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--upstream-port", type=int, default=13091)
    p.add_argument("--cert", required=True)
    p.add_argument("--key", required=True)
    args = p.parse_args()

    ProxyHandler.upstream_port = args.upstream_port
    server = http.server.ThreadingHTTPServer((args.listen, args.port), ProxyHandler)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(certfile=args.cert, keyfile=args.key)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    print(f"zoreon-https-proxy listening https://{args.listen}:{args.port} → 127.0.0.1:{args.upstream_port}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
