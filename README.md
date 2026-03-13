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

## Chat endpoint

`POST /chat` accepts a single user message and can call tools to add or delete calorie entries.
For deletes, the assistant first reads today's summary (same logic/data as `GET /days/today`) and then deletes by exact entry UUID.

Example:

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"log 450 calories for chicken wrap"}'
```
