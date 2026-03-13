import { Router } from "express";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";
import { calculateLogicalDay } from "../day-logic.js";
import { buildTodaySummary } from "../daily-summary.js";
import { ApiError, notFound } from "../errors.js";
import { parseChatInput, parseCreateEntryInput, parseEntryId } from "../validation.js";
import type { AppDeps } from "../app.js";
import type { CalorieEntry, ChatAction, ChatResponse } from "../types.js";

const maxToolRounds = 5;

const systemPrompt =
  "You are a calorie logging assistant. Use tools for add/delete actions whenever possible. " +
  "For delete intent, call list_today_entries first, then call delete_entry_by_id using an id from that list. " +
  "Never invent ids. If unsure, ask a concise clarification question and do not delete. " +
  "When calling add_entry, always format note in Professional Title Case. " +
  "Do not suggest next actions or next steps in your reply.";

const chatTools = [
  {
    type: "function",
    name: "add_entry",
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
    name: "list_today_entries",
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
    name: "delete_entry_by_id",
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
  if (toolCall.name === "add_entry") {
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

  if (toolCall.name === "list_today_entries") {
    return buildTodaySummary(deps);
  }

  if (toolCall.name === "delete_entry_by_id") {
    const rawArgs = parseJsonObject(toolCall.argsJson);
    const entryId = parseEntryId(rawArgs.entry_id);
    const changes = deps.db.deleteEntry(entryId);
    if (changes === 0) {
      throw notFound("calorie entry not found", { entryId });
    }

    actions.push({ type: "delete_entry", entry_id: entryId, deleted: true });
    return { ok: true, deleted: true, entry_id: entryId };
  }

  throw new ApiError(400, "bad_request", `unsupported tool requested: ${toolCall.name}`);
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
  } catch {
    throw new ApiError(500, "internal_error", "chat provider request failed");
  }
}
