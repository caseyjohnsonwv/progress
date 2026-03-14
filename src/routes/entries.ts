import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { calculateLogicalDay } from "../day-logic.js";
import { notFound } from "../errors.js";
import { parseCreateEntryInput, parseEditEntryInput, parseEntryId } from "../validation.js";
import type { AppDeps } from "../app.js";
import type { CalorieEntry } from "../types.js";

export function createEntriesRouter(deps: AppDeps): Router {
  const router = Router();

  router.post("/entries", (req, res) => {
    const payload = parseCreateEntryInput(req.body);
    const now = new Date();
    const consumedAt = now.toISOString();
    const entry: CalorieEntry = {
      id: uuidv4(),
      note: payload.note,
      calories: payload.calories,
      consumed_at: consumedAt,
      day: calculateLogicalDay(now, deps.config.appTimezone),
    };

    deps.db.insertEntry(entry);
    res.status(201).json(entry);
  });

  router.delete("/entries/:entryId", (req, res) => {
    const entryId = parseEntryId(req.params.entryId);
    const changes = deps.db.deleteEntry(entryId);
    if (changes === 0) {
      throw notFound("calorie entry not found", { entryId });
    }

    res.status(204).send();
  });

  router.patch("/entries/:entryId", (req, res) => {
    const entryId = parseEntryId(req.params.entryId);
    const patch = parseEditEntryInput(req.body);
    const entry = deps.db.updateEntryById(entryId, patch);
    if (!entry) {
      throw notFound("calorie entry not found", { entryId });
    }

    res.json(entry);
  });

  return router;
}
