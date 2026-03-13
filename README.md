# Calorie Tracker

Minimal single-user calorie tracker with a TypeScript Express API and a small React UI.

## Requirements

- Node.js 20+
- npm

## Environment Variables

- `CALORIE_DAILY_BUDGET` (required, positive integer)
- `APP_TIMEZONE` (required, IANA timezone, e.g. `America/New_York`)
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
