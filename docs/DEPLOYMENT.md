# KidSuraksha Deployment

Stage 9 provides two deployment modes:

- `infra/docker-compose.yml` — local/Codespace-friendly HTTP development stack.
- `infra/docker-compose.production.yml` — production stack using prebuilt GHCR images, private service networks, TLS at Nginx, health-gated startup, and a separate migration job.

## Current runtime baseline

- Node.js 24.21.0 LTS for API/web images. Node 24 is an active LTS line. citeturn718657search2turn718657search9
- PostgreSQL 17.11. PostgreSQL recommends the current minor release for each supported major. citeturn718657search0
- Redis 8.10.2 for the self-hosted template.
- Nginx 1.29 for the reverse-proxy template.

## Production host prerequisites

Use a Linux host or managed environment with:

- Docker Engine + Compose plugin
- DNS control for the public hostname
- a valid TLS certificate and private key outside Git
- persistent storage for PostgreSQL/Redis
- a backup destination outside the application host
- a deployment user with least-privilege Docker access appropriate to the host

## Production environment

Create a host-only `.env` from `.env.production.example`.

Generate URL-safe secrets with a cryptographic generator, for example:

```bash
openssl rand -hex 32
```

For the encryption key, generate exactly 32 random bytes and base64-encode them:

```bash
openssl rand -base64 32
```

The database/Redis passwords in the Compose URL must be URL-safe. The included `ops/preflight.sh` enforces this so a password containing `@`, `:`, `/` or `#` cannot silently corrupt the connection URL.

Required production settings include:

- `DOMAIN`
- `TLS_DIR`
- `IMAGE_TAG`
- `POSTGRES_PASSWORD`
- `DATA_ENCRYPTION_KEY`
- `PAIRING_CODE_SECRET`
- `REDIS_PASSWORD`
- Razorpay secrets/plan IDs

### Razorpay plans

Create exactly two recurring Razorpay plans for new customers:
- **Weekly:** ₹49 every week (one child)
- **Monthly:** ₹199 every month (up to two children)

Set their plan IDs as `RAZORPAY_PLAN_WEEKLY` and `RAZORPAY_PLAN_MONTHLY`. The currently created plans are `plan_TiZwqmv6Bf9sRb` (weekly) and `plan_TiZycXcSEyUI4V` (monthly); these are prefilled in `.env.production.example`. Do not configure an annual purchase option. Razorpay subscriptions require a finite `total_count`; KidSuraksha configures 520 weekly cycles and 120 monthly cycles, each approximately 10 years, which is within Razorpay's documented maximum. After a subscription reaches that limit, the customer can start a new subscription. citeturn982280search1turn237988search3

For an existing deployment, `RAZORPAY_PLAN_STARTER` may remain configured temporarily so an existing ₹199/month Starter subscription can still be recognized; it is not exposed as a new purchase option.
- `API_IMAGE` and `WEB_IMAGE` when using a non-default registry

Run:

```bash
./ops/preflight.sh
```

before the first production start.

## TLS

The production Nginx container expects:

```text
$TLS_DIR/fullchain.pem
$TLS_DIR/privkey.pem
```

The certificate lifecycle is intentionally outside the application container. Use a managed certificate service or an ACME client on the host/platform. Never commit private keys to Git or put them in GitHub Actions logs.

## First production deployment

1. Log in to GHCR on the host with a read-only package token.
2. Copy `infra/docker-compose.production.yml` and `infra/nginx-production.conf` to the deployment directory.
3. Put the production `.env` and TLS files on the host.
4. Set `IMAGE_TAG` to an immutable release tag.
5. Pull the application images.
6. Run the migration job.
7. Start the stack.
8. Verify `/healthz`.

Example:

```bash
docker compose -f infra/docker-compose.production.yml pull
docker compose -f infra/docker-compose.production.yml run --rm migrate
docker compose -f infra/docker-compose.production.yml up -d
curl --fail https://your-domain.example/healthz
```

The API does **not** migrate the database when it boots. This makes failed migrations visible and prevents each API replica from racing to alter the schema.

## Web/API routing

The public proxy uses:

```text
https://your-domain.example/                 → web
https://your-domain.example/api/*            → API /v1/*
https://your-domain.example/api/events/stream → API /v1/events/stream
https://your-domain.example/healthz           → API /health/ready
```

Therefore the Razorpay webhook URL is:

```text
https://your-domain.example/api/billing/webhook
```

Do not add `/v1` to the public path.

## Health and restart behavior

The API exposes:

```text
/health/live
/health/ready
```

`/health/live` checks that the process is alive. `/health/ready` checks PostgreSQL and Redis readiness. Docker uses `/health/live` for the API container, while Nginx exposes `/healthz` to external monitors.

API shutdown has a bounded grace period and force-exit path. The API no longer runs hourly database maintenance in its event loop; the dedicated `maintenance` service owns that work.

## Database migrations

The migration runner is transactional and uses a PostgreSQL advisory lock. Applied migrations are stored in `schema_migrations` with SHA-256 checksums.

Never change an applied migration file. Add a new numbered migration. A modified checksum fails the migration job.

`init-db.js` remains only as a compatibility alias to `migrate.js`.

## Backups and restore

Daily logical backups:

```bash
DATABASE_URL='...' BACKUP_RETENTION_DAYS=14 ./ops/backup-db.sh /var/backups/kidraksha/backup-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Restore:

```bash
CONFIRM_RESTORE=YES DATABASE_URL='...' ./ops/restore-db.sh /var/backups/kidraksha/backup-20260926T000000Z.dump
```

A logical `pg_dump` is not point-in-time recovery. PostgreSQL's WAL archiving model combines a base backup with WAL for continuous recovery. For a serious SaaS production footprint, use managed PostgreSQL backup/PITR or operate WAL archiving separately. citeturn335498search6

Backups must be stored off-host/off-volume and encrypted by the chosen backup platform. Perform restore drills regularly.

## Redis

Redis backs distributed rate limits. It is not the source of truth for notifications. The self-hosted production template protects Redis with a password and keeps it on the private Docker network.

For larger deployments, use a managed Redis service with TLS, monitoring and an explicit persistence/recovery policy. Redis supports RDB snapshots and AOF; the service choice should match the recovery requirements rather than assuming rate-limit state is durable business data. citeturn335498search2

## CI/CD

`.github/workflows/ci.yml` validates product/UI/realtime/security/operations checks, runs API tests and web typecheck/build, runs Android unit/lint/build checks, and builds Docker images.

Deployment workflows use GitHub `staging` and `production` environments. GitHub environments can protect deployments with approvals, branch restrictions and environment-scoped secrets; concurrency prevents simultaneous deployments to one target. citeturn335498search0turn335498search1turn335498search3

Required deployment environment secrets:

```text
DEPLOY_HOST
DEPLOY_USER
DEPLOY_PATH
DEPLOY_SSH_KEY
DEPLOY_KNOWN_HOSTS
GHCR_USERNAME
GHCR_DEPLOY_TOKEN
```

Required environment variable:

```text
PUBLIC_URL
```

Set production to require approval before the deployment job receives production secrets.

## Rollback

Application rollback is immutable-image based:

```bash
export IMAGE_TAG=v(previous-release)
docker compose -f infra/docker-compose.production.yml pull
docker compose -f infra/docker-compose.production.yml run --rm migrate
docker compose -f infra/docker-compose.production.yml up -d
```

Do not edit or delete applied migration files to roll back. If an application version requires an incompatible database shape, ship a forward-compatible migration or perform a verified database restore.

## Android release

Set the Gradle property exactly as:

```bash
-PKIDRAKSHA_API_URL=https://your-domain.example
```

The release build fails if this value is missing. Build/sign the AAB outside the source repository and store release artifacts in the CI artifact system or distribution pipeline.

## Final operational checks

```bash
bash scripts/check-product.sh
bash scripts/check-web-ui.sh
bash scripts/check-realtime.sh
bash scripts/check-security.sh
bash scripts/check-ops.sh

npm --workspace @kidraksha/api test
npm --workspace @kidraksha/web run typecheck
npm --workspace @kidraksha/web run build
```

Also run `./ops/preflight.sh`, the external `/healthz` check, a database restore drill, and the physical Android end-to-end suite before launch.
