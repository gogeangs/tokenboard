# TokenBoard MVP

TokenBoard is a Next.js + Postgres + Prisma web MVP for viewing OpenAI costs/usage and personal credits by workspace.

## Features

- Email/password auth (JWT in HTTPOnly cookie)
- Workspace model with owner membership
- OpenAI key storage with AES-256-GCM encryption (organization admin key or personal key)
- OpenAI data sync from:
  - `GET /v1/organization/costs`
  - `GET /v1/organization/usage/completions`
- Personal credit sync from:
  - `GET /v1/dashboard/billing/credit_grants`
  - Dashboard month/today values are estimated from personal credit usage deltas
- Dashboard summary + trend chart + breakdown + settings
- Monthly budget (remaining budget calculation)
- Cron sync endpoint protected by `CRON_SECRET`

## Tech Stack

- Next.js App Router + TypeScript (strict)
- Prisma + PostgreSQL
- Tailwind CSS + Recharts
- JWT (`jose`) + `bcryptjs`
- Zod validation

## Local Run

1. Install dependencies.

```bash
npm install
```

2. Configure env.

```bash
cp .env.example .env
```

3. Run migrations and Prisma client generation.

```bash
npm run prisma:generate
npm run prisma:dev
```

4. Start app.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Local Run (Docker, one command)

If local Node/WSL environment is unstable, use Docker:

1. Generate a 32-byte base64 encryption key:

```bash
openssl rand -base64 32
```

2. Open `docker-compose.yml` and replace:
- `ENCRYPTION_KEY`
- `JWT_SECRET`
- `CRON_SECRET`

3. Start services:

```bash
docker compose up --build
```

4. Open `http://localhost:3000`.

5. Stop:

```bash
docker compose down
```

## API Endpoints

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/workspaces`
- `POST /api/openai/connect`
  - body: `{ workspaceId, apiKey, mode: "organization" | "personal" }`
- `POST /api/openai/sync`
  - body: `{ workspaceId }` (owner only, manual sync)
- `POST /api/budgets`
- `GET /api/summary?workspaceId=&month=YYYY-MM`
- `GET /api/trend?workspaceId=&from=&to=` (`from/to` ISO datetime)
- `GET /api/breakdown?workspaceId=&month=YYYY-MM&by=project|line_item|model`
- `GET /api/cron/sync-openai` (Authorization: `Bearer ${CRON_SECRET}`)

## Cron (Vercel)

`vercel.json` config triggers daily sync at `02:00 UTC`.

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-openai",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Vercel will include `Authorization: Bearer ${CRON_SECRET}` when env var is set.

## Deployment (Vercel)

1. Push repository to Git provider.
2. Import project in Vercel.
3. Set environment variables from `.env.example`.
4. Set Postgres `DATABASE_URL`.
5. Deploy.
6. Run `prisma migrate deploy` as build/deploy step.

## Security Notes

- OpenAI keys are never sent to client storage.
- Encrypted at rest via AES-256-GCM (`ENCRYPTION_KEY`).
- Sensitive values are not logged.
- All workspace APIs verify membership/ownership.
