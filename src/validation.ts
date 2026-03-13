import { z } from "zod";
import { badRequest } from "./errors.js";

const uuidSchema = z.string().uuid();

export const createEntrySchema = z
  .object({
    note: z.string().max(200),
    calories: z.number().int().min(0),
  })
  .strict();

const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "day must be in YYYY-MM-DD format")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: "day must be a valid YYYY-MM-DD date",
  });

export function parseCreateEntryInput(input: unknown): { note: string; calories: number } {
  const result = createEntrySchema.safeParse(input);
  if (!result.success) {
    throw badRequest("invalid request body", { issues: result.error.issues });
  }

  const note = result.data.note.trim();
  if (note.length === 0) {
    throw badRequest("note must be non-empty after trimming", { field: "note" });
  }

  return {
    note,
    calories: result.data.calories,
  };
}

export function parseEntryId(input: unknown): string {
  const result = uuidSchema.safeParse(input);
  if (!result.success) {
    throw badRequest("entryId must be a valid UUID", { field: "entryId" });
  }
  return result.data;
}

export function parseDay(input: unknown): string {
  const result = daySchema.safeParse(input);
  if (!result.success) {
    throw badRequest("day must be a valid YYYY-MM-DD date", { field: "day" });
  }
  return result.data;
}
