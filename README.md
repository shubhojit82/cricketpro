# CricketPro

Enterprise cricket tournament management platform for players, teams, tournaments, match operations, and lifecycle workflows.

## Prerequisites

- Node.js 20 LTS
- npm 10+
- Docker Desktop or Docker Engine
- A terminal with access to the project directory

This repository is a monorepo with the API in `apps/api` and the Prisma schema in `packages/database/prisma/schema.prisma`.

## 1. Install dependencies

From the repository root:

```bash
cd /Users/shubhojitchowdhury/Projects/JJDigital/cricketpro
npm install
```

The workspace configuration in `package.json` installs dependencies for both the application and shared packages.

## 2. Create the environment file

Create a root `.env` file from the example:

```bash
cp .env.example .env
```

The app reads `.env` from the project root via `ConfigModule.forRoot({ envFilePath: '../../.env' })`, and the Prisma database package expects `DATABASE_URL` to be defined.

Use this exact configuration for local development:

```env
DATABASE_URL="postgresql://cricketpro:cricketpro@localhost:5432/cricketpro?schema=public"
REDIS_URL="redis://localhost:6379"
API_PORT=3000
JWT_SECRET="change-me-in-production"
DEFAULT_TENANT_ID="tenant_123"
```

If you prefer to run the database with different credentials, make sure the values match the Postgres container in `infrastructure/docker/docker-compose.yml`.

## 3. Start PostgreSQL and Redis

From the repository root:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up -d
```

Check that both services are up:

```bash
docker compose -f infrastructure/docker/docker-compose.yml ps
```

The compose file starts:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

## 4. Prepare the Prisma database

Generate the Prisma client:

```bash
npx prisma generate --schema packages/database/prisma/schema.prisma
```

For a first-time local setup, run the migrations:

```bash
npx prisma migrate dev --schema packages/database/prisma/schema.prisma --name init
```

If the database already exists and the migrations are committed, use:

```bash
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
```

## 5. Start the API

Run the NestJS API in watch mode:

```bash
npm run dev --workspace=apps/api
```

You can also run it directly inside the app folder:

```bash
cd apps/api
npm run dev
```

By default, the API listens on port `3000`.

## 6. Verify the service is running

Health check:

```bash
curl http://localhost:3000/health
```

A healthy response should look similar to:

```json
{
  "status": "ok",
  "service": "cricketpro-api",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "redis": {
    "status": "up",
    "ping": "PONG"
  }
}
```

## 7. Run tests and build checks

Run the API test suite:

```bash
npm run test --workspace=apps/api
```

Run a TypeScript build:

```bash
npm run build --workspace=apps/api
```

## 8. Useful reset commands

Stop and remove local services:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

Stop and remove the database volume as well:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down -v
```

## Project layout

- `apps/api` — NestJS backend
- `packages/database` — Prisma client and shared database helpers
- `packages/database/prisma/schema.prisma` — database schema
- `infrastructure/docker/docker-compose.yml` — local Postgres and Redis setup

This project is intentionally structured around a root-level `.env`, workspace dependencies, and Docker-managed infrastructure so the API can be developed consistently across machines.
