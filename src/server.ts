import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDatabase } from "./db.js";

function main(): void {
  const config = loadConfig(process.env);
  const db = createDatabase(config.sqliteDbPath);
  const app = createApp({ config, db });

  app.listen(config.port, () => {
    console.log(`Calorie Tracker API listening on http://localhost:${config.port}`);
  });
}

main();
