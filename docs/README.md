# Docs index

Public documentation for **[Zoreon](https://github.com/zyvorai/zoreon)** — Zyvor ops chat for infrastructure cutovers.

**Mattermost is the tape; Zoreon is the product.** Private lab hosts and credentials do not belong in this tree.

## Start here

| Priority | Doc | Audience |
| --- | --- | --- |
| 1 | [CUSTOMER.md](CUSTOMER.md) | Organizations — clone, Compose, bootstrap admin, TLS |
| 2 | [TESTING.md](TESTING.md) | Developers / QA — unit, curl smoke, Playwright, browser checklist |
| 3 | [ENV.md](ENV.md) | Operators — every env var |

## Deploy paths

| Doc | When |
| --- | --- |
| [CUSTOMER.md](CUSTOMER.md) | **Preferred** — Docker Compose greenfield |
| [HELM.md](HELM.md) | Kubernetes (chart under `charts/zoreon`) |
| [DEPLOY.md](DEPLOY.md) | Advanced — podman + systemd on one Linux host |
| [OPERATIONS.md](OPERATIONS.md) | Day-2 for the advanced host path |

## Product model

| Doc | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Planes, auth, messaging modes, realtime, huddles, naming |

Root [README](../README.md) is the public overview (features, quick start, badges).
