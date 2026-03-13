# Calorie Tracker API

Minimal single-user calorie tracking backend implemented with Node 20, TypeScript, Express, and SQLite.

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
```

## Run

```bash
cp .env.example .env
npm run dev
```

Server endpoints:
- `POST /entries`
- `DELETE /entries/{entryId}`
- `GET /days/{day}`
- `GET /days/today`
- `GET /openapi.yaml`
- `GET /docs`
- `GET /health`

## Build and start

```bash
npm run build
npm start
```
