# Helm — Kubernetes install

Chart: [`charts/zoreon`](../charts/zoreon). Prefer Compose for a single VM ([CUSTOMER.md](CUSTOMER.md)); use Helm when you already run Kubernetes.

## Prerequisites

- Kubernetes 1.25+
- Helm 3
- A built/pushed image (`docker build -t your-registry/zoreon:0.1.0 . && docker push …`)

## Install (in-cluster Postgres)

```bash
helm upgrade --install zoreon ./charts/zoreon \
  --namespace zoreon --create-namespace \
  --set image.repository=your-registry/zoreon \
  --set image.tag=0.1.0 \
  --set env.BETTER_AUTH_URL=https://zoreon.example.com \
  --set env.ZOREON_BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
  --set secret.BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  --set postgresql.auth.password="$(openssl rand -hex 16)" \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=zoreon.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

## External Postgres

```bash
helm upgrade --install zoreon ./charts/zoreon \
  --namespace zoreon --create-namespace \
  --set postgresql.enabled=false \
  --set secret.DATABASE_URL='postgres://zoreon:…@postgres.example.com:5432/zoreon' \
  --set secret.BETTER_AUTH_SECRET='…' \
  --set env.BETTER_AUTH_URL=https://zoreon.example.com \
  --set image.repository=your-registry/zoreon \
  --set image.tag=0.1.0
```

Or mount an existing Secret:

```bash
kubectl -n zoreon create secret generic zoreon-secrets \
  --from-literal=BETTER_AUTH_SECRET=… \
  --from-literal=DATABASE_URL=postgres://… \
  --from-literal=MATTERMOST_TOKEN= \
  --from-literal=SMTP_USER= \
  --from-literal=SMTP_PASS= \
  --from-literal=VAPID_PUBLIC_KEY= \
  --from-literal=VAPID_PRIVATE_KEY=

helm upgrade --install zoreon ./charts/zoreon \
  --set secret.create=false \
  --set existingSecret=zoreon-secrets \
  --set postgresql.enabled=false \
  …
```

## Values of note

| Key | Purpose |
| --- | --- |
| `image.*` | Container image |
| `env.BETTER_AUTH_URL` | Public origin |
| `env.ZOREON_BOOTSTRAP_ADMIN_EMAIL` | First admin |
| `postgresql.enabled` | In-cluster Postgres StatefulSet |
| `ingress.enabled` | Expose via Ingress |
| `existingSecret` | Use cluster Secret instead of chart-managed |

## Verify

```bash
kubectl -n zoreon rollout status deploy/zoreon
kubectl -n zoreon port-forward svc/zoreon 8080:8080
BASE_URL=http://localhost:8080 ./scripts/customer-smoke.sh
```
