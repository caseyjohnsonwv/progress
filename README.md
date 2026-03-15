# Calorie Tracker

Minimal single-user calorie tracker with a TypeScript Express API and a small React UI.

## Requirements

- Node.js 20+
- npm

## Environment Variables

- `CALORIE_DAILY_BUDGET` (required, positive integer)
- `APP_TIMEZONE` (required, IANA timezone, e.g. `America/New_York`)
- `OPENAI_API_KEY` (required, used by `/chat`)
- `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)
- `PORT` (optional, default `8000`)
- `SQLITE_DB_PATH` (optional, default `./data/calories.db`)
- `BASIC_AUTH_USERNAME` + `BASIC_AUTH_PASSWORD` (optional, but both must be set together)

The server auto-loads a local `.env` file via `dotenv`.

## Install

```bash
npm install
npm run web:install
```

## Run in development

```bash
cp .env.example .env
npm run dev
npm run web:dev
```

In development:
- API runs on `http://localhost:8000`
- UI runs on `http://localhost:5173` and proxies `/days` and `/entries` to the API

API endpoints:
- `POST /entries`
- `PATCH /entries/{entryId}`
- `DELETE /entries/{entryId}`
- `GET /days/{day}`
- `GET /days/today`
- `POST /chat`
- `GET /openapi.yaml`
- `GET /docs`
- `GET /health`

## Build and start (production)

```bash
npm run build
npm start
```

In production:
- Express serves the built React UI at `/`
- Existing API/docs routes remain available at their current paths
- If `BASIC_AUTH_USERNAME` and `BASIC_AUTH_PASSWORD` are set, all routes require HTTP Basic Auth

## Chat endpoint

`POST /chat` accepts a single user message and can call tools to add, edit, or delete calorie entries.
For edits/deletes, the assistant first reads today's summary (same logic/data as `GET /days/today`) and then uses exact entry UUIDs from that list.
For past-entry lookup, the assistant can search historical entries by note (`search_past_entries_by_note`) or by day (`search_past_entries_by_day` with `YYYY-MM-DD`).
The assistant is also given current logical-day context each request so relative dates are resolved before tool calls.
Historical entries are read-only in chat for edit/delete.
For duplication, the assistant first performs historical lookup and auto-adds only when a single clear match is found.
If multiple plausible matches are found, the assistant asks for concise clarification before adding.

Example:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"log 450 calories for chicken wrap"}'
```

## Fly.io Deployment (Docker + SQLite volume)

This repository includes:
- `Dockerfile` for production image builds
- `.dockerignore` for smaller/faster Docker builds
- `fly.toml` with:
  - internal port `8000`
  - health check on `/health`
  - mounted volume at `/data`
  - `SQLITE_DB_PATH=/data/calories.db`

### One-time setup

1. Install and authenticate Fly CLI:
```bash
fly auth login
```

2. Create the app (or use an existing one):
```bash
fly apps create <your-app-name>
```

3. Update `fly.toml`:
- Set `app = "<your-app-name>"`.
- Optionally set `primary_region` to your nearest region.

4. Create a persistent SQLite volume:
```bash
fly volumes create calorie_data --size 1 --region iad
```

### Configure secrets and environment

Set required secrets:
```bash
fly secrets set \
  CALORIE_DAILY_BUDGET=2200 \
  APP_TIMEZONE=America/New_York \
  OPENAI_API_KEY=<your-openai-api-key> \
  OPENAI_MODEL=gpt-4.1-mini \
  BASIC_AUTH_USERNAME=<your-username> \
  BASIC_AUTH_PASSWORD=<strong-password>
```

`NODE_ENV`, `PORT`, and `SQLITE_DB_PATH` are already defined in `fly.toml`.

### Deploy

```bash
fly deploy
```

### Verify auth + health

1. No credentials should return `401`:
```bash
curl -i https://<your-app-name>.fly.dev/health
```

2. Correct credentials should return `200`:
```bash
curl -i -u "<your-username>:<strong-password>" https://<your-app-name>.fly.dev/health
```

### Smoke test key routes (with auth)

```bash
curl -i -u "<your-username>:<strong-password>" https://<your-app-name>.fly.dev/
curl -i -u "<your-username>:<strong-password>" https://<your-app-name>.fly.dev/days/today
curl -i -u "<your-username>:<strong-password>" https://<your-app-name>.fly.dev/docs
curl -i -u "<your-username>:<strong-password>" https://<your-app-name>.fly.dev/openapi.yaml
```

### Persistence check

1. Add an entry.
2. Restart machine:
```bash
fly machine restart <machine-id>
```
3. Confirm the entry still exists (`/days/today`), verifying SQLite volume persistence.

### Rotate credentials

```bash
fly secrets set BASIC_AUTH_USERNAME=<new-username> BASIC_AUTH_PASSWORD=<new-password>
```

### Rollback

1. List releases:
```bash
fly releases
```
2. Roll back:
```bash
fly releases rollback <release-id>
```
