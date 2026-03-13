import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
const openApiPath = path.join(projectRoot, "openapi.yaml");

export function createDocsRouter(): Router {
  const router = Router();
  const document = YAML.load(openApiPath);

  router.get("/openapi.yaml", (_req, res) => {
    res.sendFile(openApiPath);
  });

  router.use("/docs", swaggerUi.serve, swaggerUi.setup(document));

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return router;
}
