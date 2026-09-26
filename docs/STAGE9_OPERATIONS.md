# Stage 9 — Operations & Deployment

Stage 9 turns the KidRaksha monorepo into an operator-ready deployment shape. It separates schema migration from API startup, separates scheduled maintenance from API workers, adds liveness/readiness probes, hardens containers, provides backup/restore tooling, and adds protected GitHub deployment workflows.

## Runtime topology

```text
Internet
   │
 HTTPS
   ▼
 Nginx / TLS
   ├── /        → Next.js web
   ├── /api/*   → Express API
   └── /api/events/stream → long-lived SSE
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
      PostgreSQL            Redis
          ▲                   ▲
          │                   │
      migration            rate limits
          │
      maintenance
```

The production compose file uses immutable application image tags supplied by CI/CD. PostgreSQL, Redis, API, maintenance and web remain on the private Docker network; only Nginx publishes ports.

## Startup ordering

1. PostgreSQL becomes healthy.
2. The migration job acquires a PostgreSQL advisory transaction lock, applies `schema.sql`, and then applies each unapplied migration exactly once.
3. Each migration is stored with a SHA-256 checksum. Editing an already-applied migration fails loudly instead of silently changing history.
4. Redis becomes healthy.
5. API starts only after migration and Redis health requirements are satisfied.
6. Web starts only after API readiness.
7. Nginx starts only after API and web health checks pass.

Docker Compose health-gated dependencies are intentional: the API should not start against an uninitialized or unavailable database. GitHub deployment environments/concurrency are likewise intentional so production secrets are protected by environment rules and overlapping production deployments are prevented. citeturn335498search0turn335498search3

## Health endpoints

- `/health/live` — process/liveness only; no database dependency.
- `/health/ready` — database plus Redis readiness.
- `/healthz` on the production Nginx endpoint — proxy-facing readiness check.

External uptime monitoring should probe `/healthz`, not a customer dashboard route.

## Database migrations

Use the one-shot migration job:

```bash
npm --workspace @kidraksha/api run migrate
```

Never edit an applied migration. Add a new numbered migration instead. The migration runner checksums every migration and will refuse to start if an applied migration's contents change.

For production deployment the CI job runs:

```bash
docker compose -f infra/docker-compose.production.yml run --rm migrate
```

The API container does not auto-migrate on boot.

## Backups

`ops/backup-db.sh` creates a PostgreSQL custom-format logical backup with restrictive file permissions and optional retention cleanup.

Example daily job on a dedicated backup host:

```bash
DATABASE_URL='...' BACKUP_RETENTION_DAYS=14 ./ops/backup-db.sh /var/backups/kidraksha/backup-$(date -u +%Y%m%dT%H%M%SZ).dump
```

`ops/restore-db.sh` is intentionally destructive and requires `CONFIRM_RESTORE=YES`.

A logical `pg_dump` is not a replacement for PostgreSQL WAL archiving/point-in-time recovery. For a production SaaS, use managed PostgreSQL with automated backups and PITR where the service tier supports it, or operate WAL archiving separately. PostgreSQL documents combining base backups with WAL for continuous archiving and recovery. citeturn335498search6

Run a restore drill at least quarterly and record the restore duration and verification result.

## Redis operations

Redis is used for distributed rate limiting, not as the source of truth for notifications. The production Compose template keeps Redis private and password-protected. For a larger production deployment, a managed Redis service with TLS, backups/appropriate persistence, monitoring, and controlled network access is preferred. Redis documents AOF and RDB as its persistence mechanisms and notes that disabling persistence removes recovery protection. citeturn335498search2

## TLS and Nginx

`infra/nginx-production.conf` expects:

```text
${TLS_DIR}/fullchain.pem
${TLS_DIR}/privkey.pem
```

Certificate issuance/renewal is intentionally external to the application image. Use an ACME client, managed load balancer, or managed certificate service appropriate to the hosting platform. Never place private keys in GitHub or the repository.

The production proxy:

- redirects HTTP to HTTPS;
- supports TLS 1.2 and TLS 1.3;
- disables Nginx version disclosure;
- disables proxy buffering for SSE;
- preserves forwarded client information;
- limits request body size;
- applies edge-level request limiting;
- separates `/api/`, SSE, and web proxy behavior.

## Container security

API and web images run as the non-root `node` user. Container health checks use local HTTP endpoints. Runtime images contain only the application artifacts required to execute the service.

The repository keeps `.env` files out of Git and provides example files only. Production secrets are expected to live in the deployment host's environment/secret management system and in GitHub environment secrets only where CI needs them.

## Deployments

GitHub Actions uses separate `staging` and `production` environments. GitHub environments can restrict branches, gate jobs with approvals, and scope secrets to a deployment target. Concurrency groups prevent overlapping deployments. citeturn335498search0turn335498search1turn335498search3

### Staging

Manually trigger `Deploy staging`, select the exact image tag/commit to test, and let the workflow publish images, run migrations, restart the stack, then verify `/healthz`.

### Production

Publish a GitHub Release or manually run `Deploy production` with an existing image tag. Production should require an environment approval and deploy an immutable release tag rather than `latest`.

### Rollback

Rollback is image-tag based:

```bash
export IMAGE_TAG=v(previous-release)
docker compose -f infra/docker-compose.production.yml pull
docker compose -f infra/docker-compose.production.yml run --rm migrate
docker compose -f infra/docker-compose.production.yml up -d
```

Database migrations are forward-only. If application rollback requires reversing a schema change, ship a backward-compatible migration or restore from backup after assessing data loss; do not edit an applied migration file.

## Secrets rotation

### Data encryption key

1. Generate a new 32-byte key.
2. Deploy with the new value in `DATA_ENCRYPTION_KEY` and the old value in `DATA_ENCRYPTION_KEY_PREVIOUS`.
3. Verify reads/decryptions work.
4. Run a controlled re-encryption job in a future maintenance stage.
5. Remove the previous key only after all ciphertext has been re-encrypted.

### Pairing and webhook secrets

Rotate by issuing new secrets, deploying them during a controlled change window, verifying the relevant flow, and then invalidating the old secret at the provider where applicable.

### Deployment SSH/GHCR credentials

Use separate staging and production credentials. Store the host's SSH public key material in `DEPLOY_KNOWN_HOSTS` rather than using `ssh-keyscan` during deployment.

## Operational signals

Minimum alerts:

- `/healthz` unavailable for 2 consecutive checks;
- API error-rate spike;
- repeated `maintenance_failed` logs;
- migration job failure;
- Redis readiness loss;
- PostgreSQL readiness loss;
- backup job failure;
- disk-space threshold breach on hosts running PostgreSQL/Redis;
- unusual deployment failure rate.

Structured API logs carry request IDs, method/path/status/duration, parent/device context where available, and redact authentication/cookie/token fields.

## Recovery objectives

Set concrete RPO/RTO targets with the hosting provider before launch. The repository does not claim a specific RPO/RTO because those depend on the actual database/Redis/compute service chosen.

## Pre-launch infrastructure checklist

```text
[ ] DNS resolves to the production edge
[ ] TLS certificate is valid and renewal is configured
[ ] Production secrets are present and unique
[ ] GHCR deploy credentials are scoped to read packages
[ ] Staging and production GitHub environments are configured
[ ] Production environment requires approval
[ ] Backup schedule is active
[ ] Restore drill has succeeded
[ ] External /healthz monitor is active
[ ] Database disk/connection monitoring is active
[ ] Redis monitoring is active
[ ] Release rollback tag is known
[ ] Android release artifact is stored outside the source repository
```
