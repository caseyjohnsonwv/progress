import express from "express";
import { createDaysRouter } from "./routes/days.js";
import { createEntriesRouter } from "./routes/entries.js";
import { createDocsRouter } from "./routes/docs.js";
import { errorHandler } from "./errors.js";
import type { AppConfig } from "./config.js";
import type { DatabaseClient } from "./db.js";

export type AppDeps = {
  config: AppConfig;
  db: DatabaseClient;
};

export function createApp(deps: AppDeps) {
  const app = express();

  app.use(express.json());
  app.use(createDocsRouter());
  app.use(createEntriesRouter(deps));
  app.use(createDaysRouter(deps));

  app.use(errorHandler);
  return app;
}
