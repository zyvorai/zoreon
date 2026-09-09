# Remote deploy

Lab pattern: SSH → rsync → **podman** image build → **systemd** unit.

## Prerequisites (remote host)

- SSH key auth for the deploy user (default `sus`)
- Passwordless `sudo`
- `podman` (or set `BUILDER=docker`)

## Deploy

```bash
./scripts/deploy-remote.sh <host> [user] [--port 30591]
make deploy-remote H=<host> U=sus PORT=30591

# Optional Mattermost probe URL inside the container
MATTERMOST_URL=http://zoreon.example.com:31722 ./scripts/deploy-remote.sh zoreon.example.com sus
```

| Artifact | Value |
| --- | --- |
| Staging | `~/.deployments/agora` |
| Image | `agora:latest` |
| Unit | `/etc/systemd/system/agora.service` |
| Port | `30591` (default) → container `8080` |
| State file | `.deploy-remote-last` (local, gitignored) |

## Uninstall

```bash
./scripts/deploy-remote.sh <host> <user> --uninstall
# or reuse last host
./scripts/deploy-remote.sh --uninstall
```

## Verify

```bash
curl -fsS -o /dev/null -w "%{http_code}\n" http://<host>:30591/
curl -fsS -o /dev/null -w "%{http_code}\n" http://<host>:30591/login
ssh <user>@<host> 'sudo systemctl is-active agora && sudo podman ps | grep agora'
```

## Current lab

| Service | URL |
| --- | --- |
| Agora | http://zoreon.example.com:30591/ |
| Mattermost | http://zoreon.example.com:31722/ (`/opt/mattermost-docker/`) |
