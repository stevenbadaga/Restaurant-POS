# Restaurant POS Production Deployment

This guide deploys the Restaurant POS with Docker Compose, PostgreSQL, a production backend, an nginx-served frontend, persistent runtime volumes, health checks, migrations, seed commands, and database backups.

## Prerequisites

- Docker Engine with Docker Compose v2
- A DNS record pointing your HTTPS hostname to the server
- HTTPS termination in front of the `frontend` service, such as Caddy, Traefik, nginx, Cloudflare Tunnel, or a managed load balancer
- PostgreSQL backups stored outside the application server

## 1. Create Production Environment

```bash
cp .env.production.example .env.production
```

Generate secrets:

```bash
openssl rand -hex 64
openssl rand -hex 64
openssl rand -base64 48
```

Edit `.env.production`:

- `CLIENT_URL=https://pos.example.com`
- `ALLOWED_ORIGINS=https://pos.example.com`
- `POSTGRES_PASSWORD=<strong database password>`
- `DATABASE_URL=postgresql://restaurant_pos:<same password>@postgres:5432/restaurant_pos`
- `JWT_ACCESS_SECRET=<openssl rand -hex 64>`
- `JWT_REFRESH_SECRET=<openssl rand -hex 64>`
- `COOKIE_SECURE=true`
- `TRUST_PROXY=true`
- leave `VITE_API_URL` unset for same-origin `/api`, or set it only for a separate API origin

Do not commit `.env.production`.

## 2. Build Images

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
```

Equivalent npm script:

```bash
npm run prod:build
```

## 3. Start PostgreSQL

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## 4. Apply Migrations

Run migrations before starting the app:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run db:migrate:prod
```

Equivalent npm script:

```bash
npm run prod:migrate
```

## 5. Seed Initial Data

Only seed a fresh database or when you intentionally need the configured seed data:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run db:seed
```

Equivalent npm script:

```bash
npm run prod:seed
```

## 6. Start Application

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Equivalent npm script:

```bash
npm run prod:up
```

Check health:

```bash
curl -fsS http://localhost/health
curl -fsS http://localhost/api/health/live
curl -fsS http://localhost/api/health/ready
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

View logs:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f --tail=200
```

Equivalent npm script:

```bash
npm run prod:logs
```

## HTTPS

The frontend container listens on port `80`. Put an HTTPS reverse proxy in front of it and forward:

- `/` to `frontend:80`
- `/api/` to `frontend:80` or directly to `backend:5000`
- `/socket.io/` with WebSocket upgrade headers

Production backend settings require:

```env
COOKIE_SECURE=true
TRUST_PROXY=true
CLIENT_URL=https://pos.example.com
ALLOWED_ORIGINS=https://pos.example.com
```

## Persistent Data

Compose creates these named volumes:

- `postgres_data`: PostgreSQL database files
- `postgres_backups`: optional Postgres-side backup mount
- `backend_uploads`: persistent uploaded/runtime assets
- `backend_backups`: application backup output
- `backend_temp`: PDF/temp runtime files

Do not delete these volumes during upgrades unless you have verified backups.

## Backups

From a host with PostgreSQL client tools:

```bash
./scripts/backup-database.sh ./backups
```

Restore requires explicit destructive confirmation:

```bash
./scripts/restore-database.sh ./backups/restaurant-pos-YYYY-MM-DD-HHMMSS.dump "$DATABASE_URL"
```

Docker-only backup example:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=9 \
  --file="/backups/restaurant-pos-$(date +%Y-%m-%d-%H%M%S).dump"
```

Store backups encrypted and off-server.

## Upgrade Procedure

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run db:migrate:prod
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

## Rollback

1. Confirm you have a database backup from before the upgrade.
2. Deploy the previous image or previous git revision.
3. Restore the database only if the migration changed data or schema incompatibly.
4. Recheck `/api/health/ready` and login.
