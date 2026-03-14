import { z } from "zod";
import { badRequest } from "./errors.js";

const uuidSchema = z.string().uuid();
const chatMessageMaxLength = 2_000;

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

export function parseEditEntryInput(input: unknown): { note?: string; calories?: number } {
  const schema = z
    .object({
      note: z.string().max(200).optional(),
      calories: z.number().int().min(0).optional(),
    })
    .strict();

  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest("invalid request body", { issues: result.error.issues });
  }

  const output: { note?: string; calories?: number } = {};
  if (typeof result.data.note === "string") {
    const note = result.data.note.trim();
    if (note.length === 0) {
      throw badRequest("note must be non-empty after trimming", { field: "note" });
    }
    output.note = note;
  }

  if (typeof result.data.calories === "number") {
    output.calories = result.data.calories;
  }

  if (output.note === undefined && output.calories === undefined) {
    throw badRequest("at least one of note or calories is required", {
      fields: ["note", "calories"],
    });
  }

  return output;
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

export function parseChatInput(input: unknown): { message: string } {
  const schema = z
    .object({
      message: z.string().max(chatMessageMaxLength),
    })
    .strict();

  const result = schema.safeParse(input);
  if (!result.success) {
    throw badRequest("invalid request body", { issues: result.error.issues });
  }

  const message = result.data.message.trim();
  if (message.length === 0) {
    throw badRequest("message must be non-empty after trimming", { field: "message" });
  }

  return { message };
}
