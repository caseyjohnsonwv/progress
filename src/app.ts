import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createDaysRouter } from "./routes/days.js";
import { createEntriesRouter } from "./routes/entries.js";
import { createChatRouter } from "./routes/chat.js";
import { createDocsRouter } from "./routes/docs.js";
import { createBasicAuthMiddleware } from "./basic-auth.js";
import { errorHandler } from "./errors.js";
import type { AppConfig } from "./config.js";
import type { DatabaseClient } from "./db.js";

export type AppDeps = {
  config: AppConfig;
  db: DatabaseClient;
};

export function createApp(deps: AppDeps) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, "..");
  const webDistPath = path.join(projectRoot, "web", "dist");
  const webIndexPath = path.join(webDistPath, "index.html");
  const hasWebDist = fs.existsSync(webIndexPath);

  const app = express();

  app.use(express.json());
  if (deps.config.basicAuth) {
    app.use(createBasicAuthMiddleware(deps.config.basicAuth.username, deps.config.basicAuth.password));
  }
  app.use(createDocsRouter());
  app.use(createEntriesRouter(deps));
  app.use(createDaysRouter(deps));
  app.use(createChatRouter(deps));

  if (hasWebDist) {
    app.use(express.static(webDistPath));
    app.get("*", (req, res, next) => {
      const excludedPaths = ["/entries", "/days", "/chat", "/docs", "/openapi.yaml", "/health"];
      if (excludedPaths.some((prefix) => req.path.startsWith(prefix))) {
        next();
        return;
      }

      res.sendFile(webIndexPath);
    });
  }

  app.use(errorHandler);
  return app;
}
