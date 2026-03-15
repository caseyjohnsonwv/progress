import { Router } from "express";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { calculateLogicalDay, calculateTodayLogicalDay } from "../day-logic.js";
import { buildDailySummary, buildTodaySummary } from "../daily-summary.js";
import { ApiError, badRequest, notFound } from "../errors.js";
import {
  parseChatInput,
  parseCreateEntryInput,
  parseDay,
  parseEditEntryInput,
  parseEntryId,
  parseSearchPastEntriesInput,
} from "../validation.js";
import type { AppDeps } from "../app.js";
import type { CalorieEntry, ChatAction, ChatResponse } from "../types.js";

const maxToolRounds = 5;
const CHAT_TOOL_ADD_ENTRY = "add_entry";
const CHAT_TOOL_LIST_TODAY_ENTRIES = "list_today_entries";
const CHAT_TOOL_SEARCH_PAST_ENTRIES_BY_NOTE = "search_past_entries_by_note";
const CHAT_TOOL_SEARCH_PAST_ENTRIES_BY_DAY = "search_past_entries_by_day";
const CHAT_TOOL_DELETE_ENTRY_BY_ID = "delete_entry_by_id";
const CHAT_TOOL_EDIT_ENTRY_BY_ID = "edit_entry_by_id";

const systemPrompt =
  "You are a calorie logging assistant. Use tools for add/edit/delete actions whenever possible. " +
  "For edit or delete intent, call list_today_entries first, then call edit_entry_by_id or delete_entry_by_id using an id from that list. " +
  "For duplicate intent, call list_today_entries for today, search_past_entries_by_note for note-based historical lookup, or search_past_entries_by_day for day-based historical lookup, then call add_entry with the duplicated values. " +
  "For past-entry lookup intent, call search_past_entries_by_note (note-based) or search_past_entries_by_day (date-based). " +
  "Historical entries are read-only for edit/delete. " +
  "Never invent ids. If unsure, ask a concise clarification question and do not delete. " +
  "When calling add_entry, always format note in Professional Title Case. " +
  "Do not suggest next actions or next steps in your reply.";

const chatTools = [
  {
    type: "function",
    name: CHAT_TOOL_ADD_ENTRY,
    description: "Add a calorie entry.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["note", "calories"],
      properties: {
        note: {
          type: "string",
          description: "Short note for the calorie entry in Professional Title Case.",
        },
        calories: {
          type: "integer",
          minimum: 0,
          description: "Calorie amount for the entry.",
        },
      },
    },
  },
  {
    type: "function",
    name: CHAT_TOOL_LIST_TODAY_ENTRIES,
    description: "List today's calorie summary and entries. This mirrors the /days/today response.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    },
  },
  {
    type: "function",
    name: CHAT_TOOL_SEARCH_PAST_ENTRIES_BY_NOTE,
    description: "Search past calorie entries by note (excluding today).",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query", "limit"],
      properties: {
        query: {
          type: "string",
          description: "Case-insensitive text to match in entry note.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 25,
          description: "Maximum number of results (defaults to 10).",
        },
      },
    },
  },
  {
    type: "function",
    name: CHAT_TOOL_SEARCH_PAST_ENTRIES_BY_DAY,
    description: "Get a specific day summary for historical lookup using YYYY-MM-DD.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["day"],
      properties: {
        day: {
          type: "string",
          description: "Logical day in YYYY-MM-DD format.",
        },
      },
    },
  },
  {
    type: "function",
    name: CHAT_TOOL_DELETE_ENTRY_BY_ID,
    description: "Delete a calorie entry by UUID from list_today_entries.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["entry_id"],
      properties: {
        entry_id: {
          type: "string",
          format: "uuid",
          description: "UUID of the entry to delete.",
        },
      },
    },
  },
  {
    type: "function",
    name: CHAT_TOOL_EDIT_ENTRY_BY_ID,
    description: "Edit a calorie entry by UUID from list_today_entries without changing timestamp/day.",
    strict: false,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["entry_id"],
      properties: {
        entry_id: {
          type: "string",
          format: "uuid",
          description: "UUID of the entry to edit.",
        },
        note: {
          type: "string",
          description: "Updated short note for the calorie entry in Professional Title Case.",
        },
        calories: {
          type: "integer",
          minimum: 0,
          description: "Updated calorie amount for the entry.",
        },
      },
    },
  },
];

type ToolCall = {
  callId: string;
  name: string;
  argsJson: string;
};

export function createChatRouter(deps: AppDeps): Router {
  const router = Router();
  const client = new OpenAI({ apiKey: deps.config.openAiApiKey });

  router.post("/chat", async (req, res, next) => {
    try {
      const payload = parseChatInput(req.body);
      const actions: ChatAction[] = [];

      let response = await createResponse(client, {
        model: deps.config.openAiModel,
        input: [
          { role: "system", content: systemPrompt },
          { role: "system", content: buildDateContextLine(deps.config.appTimezone) },
          { role: "user", content: payload.message },
        ],
        tools: chatTools as any,
      });

      for (let round = 0; round < maxToolRounds; round += 1) {
        const toolCalls = extractToolCalls(response);
        if (toolCalls.length === 0) {
          const responseBody: ChatResponse = {
            reply: extractReplyText(response),
            actions,
          };
          res.json(responseBody);
          return;
        }

        const toolOutputs = toolCalls.map((toolCall) => {
          const output = runTool(toolCall, deps, actions);
          return {
            type: "function_call_output" as const,
            call_id: toolCall.callId,
            output: JSON.stringify(output),
          };
        });

        response = await createResponse(client, {
          model: deps.config.openAiModel,
          previous_response_id: response.id,
          input: toolOutputs,
          tools: chatTools as any,
        });
      }

      const responseBody: ChatResponse = {
        reply: "I couldn't complete that request safely. Please be more specific.",
        actions,
      };
      res.json(responseBody);
    } catch (err) {
      if (err instanceof ApiError) {
        next(err);
        return;
      }

      next(new ApiError(500, "internal_error", "chat provider request failed"));
    }
  });

  return router;
}

function runTool(toolCall: ToolCall, deps: AppDeps, actions: ChatAction[]): Record<string, unknown> {
  if (toolCall.name === CHAT_TOOL_ADD_ENTRY) {
    const rawArgs = parseJsonObject(toolCall.argsJson);
    const payload = parseCreateEntryInput(rawArgs);
    const now = new Date();
    const entry: CalorieEntry = {
      id: uuidv4(),
      note: payload.note,
      calories: payload.calories,
      consumed_at: now.toISOString(),
      day: calculateLogicalDay(now, deps.config.appTimezone),
    };

    deps.db.insertEntry(entry);
    actions.push({ type: "add_entry", entry });
    return { ok: true, entry };
  }

  if (toolCall.name === CHAT_TOOL_LIST_TODAY_ENTRIES) {
    return buildTodaySummary(deps);
  }

  if (toolCall.name === CHAT_TOOL_SEARCH_PAST_ENTRIES_BY_NOTE) {
    const rawArgs = parseJsonObject(toolCall.argsJson);
    const payload = parseSearchPastEntriesInput(rawArgs);
    const todayDay = calculateTodayLogicalDay(deps.config.appTimezone);
    const entries = deps.db.searchPastEntriesByNote({
      query: payload.query,
      beforeDay: todayDay,
      limit: payload.limit,
    });

    return {
      query: payload.query,
      limit: payload.limit,
      count: entries.length,
      entries,
    };
  }

  if (toolCall.name === CHAT_TOOL_SEARCH_PAST_ENTRIES_BY_DAY) {
    const rawArgs = parseJsonObject(toolCall.argsJson);
    const day = parseDay(rawArgs.day);
    return buildDailySummary(day, deps);
  }

  if (toolCall.name === CHAT_TOOL_DELETE_ENTRY_BY_ID) {
    const rawArgs = parseJsonObject(toolCall.argsJson);
    const entryId = parseEntryId(rawArgs.entry_id);
    const entry = deps.db.getEntryById(entryId);
    if (!entry) {
      throw notFound("calorie entry not found", { entryId });
    }

    const todayDay = calculateTodayLogicalDay(deps.config.appTimezone);
    if (entry.day !== todayDay) {
      throw badRequest("historical entries cannot be deleted in chat", { entryId, day: entry.day });
    }

    const changes = deps.db.deleteEntry(entryId);
    if (changes === 0) {
      throw notFound("calorie entry not found", { entryId });
    }

    actions.push({ type: "delete_entry", entry_id: entryId, deleted: true });
    return { ok: true, deleted: true, entry_id: entryId };
  }

  if (toolCall.name === CHAT_TOOL_EDIT_ENTRY_BY_ID) {
    const rawArgs = parseJsonObject(toolCall.argsJson);
    const entryId = parseEntryId(rawArgs.entry_id);
    const existing = deps.db.getEntryById(entryId);
    if (!existing) {
      throw notFound("calorie entry not found", { entryId });
    }

    const todayDay = calculateTodayLogicalDay(deps.config.appTimezone);
    if (existing.day !== todayDay) {
      throw badRequest("historical entries cannot be edited in chat", { entryId, day: existing.day });
    }

    const patch = parseEditEntryInput({
      note: rawArgs.note,
      calories: rawArgs.calories,
    });
    const entry = deps.db.updateEntryById(entryId, patch);
    if (!entry) {
      throw notFound("calorie entry not found", { entryId });
    }

    actions.push({ type: "edit_entry", entry });
    return { ok: true, entry };
  }

  throw new ApiError(400, "bad_request", `unsupported tool requested: ${toolCall.name}`);
}

function buildDateContextLine(timeZone: string): string {
  const todayDay = calculateTodayLogicalDay(timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone,
  }).format(new Date());
  return `Today in ${timeZone} is ${todayDay} (${weekday}). Resolve relative dates to absolute YYYY-MM-DD before calling tools.`;
}

function parseJsonObject(input: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch {
    throw new ApiError(400, "bad_request", "tool arguments must be valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ApiError(400, "bad_request", "tool arguments must be an object");
  }

  return parsed as Record<string, unknown>;
}

function extractToolCalls(response: unknown): ToolCall[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return [];
  }

  return output
    .filter((item): item is { type: string; call_id: string; name: string; arguments: string } => {
      return (
        typeof item === "object" &&
        item !== null &&
        (item as { type?: unknown }).type === "function_call" &&
        typeof (item as { call_id?: unknown }).call_id === "string" &&
        typeof (item as { name?: unknown }).name === "string" &&
        typeof (item as { arguments?: unknown }).arguments === "string"
      );
    })
    .map((item) => ({
      callId: item.call_id,
      name: item.name,
      argsJson: item.arguments,
    }));
}

function extractReplyText(response: unknown): string {
  if (
    response &&
    typeof response === "object" &&
    typeof (response as { output_text?: unknown }).output_text === "string"
  ) {
    const outputText = (response as { output_text: string }).output_text.trim();
    if (outputText.length > 0) {
      return outputText;
    }
  }

  if (
    response &&
    typeof response === "object" &&
    Array.isArray((response as { output?: unknown }).output)
  ) {
    const outputItems = (response as { output: unknown[] }).output;
    for (const item of outputItems) {
      if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") {
        continue;
      }

      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) {
        continue;
      }

      for (const part of content) {
        if (
          part &&
          typeof part === "object" &&
          (((part as { type?: unknown }).type === "output_text" &&
            typeof (part as { text?: unknown }).text === "string") ||
            ((part as { type?: unknown }).type === "text" &&
              typeof (part as { text?: unknown }).text === "string"))
        ) {
          const text = (part as { text: string }).text.trim();
          if (text.length > 0) {
            return text;
          }
        }
      }
    }
  }

  return "I couldn't generate a response. Please try again.";
}

async function createResponse(
  client: OpenAI,
  params: Parameters<OpenAI["responses"]["create"]>[0],
): Promise<{ id: string; output?: unknown; output_text?: string }> {
  try {
    return (await client.responses.create(params)) as {
      id: string;
      output?: unknown;
      output_text?: string;
    };
  } catch (err) {
    const providerMessage =
      err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
        ? ((err as { message: string }).message || "").trim()
        : "";

    throw new ApiError(
      500,
      "internal_error",
      "chat provider request failed",
      providerMessage ? { provider_error: providerMessage } : undefined,
    );
  }
}
