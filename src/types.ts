export type CalorieEntry = {
  id: string;
  note: string;
  calories: number;
  consumed_at: string;
  day: string;
};

export type DailySummaryResponse = {
  day: string;
  timezone: string;
  rollover_hour_local: 4;
  budget_calories: number;
  consumed_calories: number;
  remaining_calories: number;
  entries: CalorieEntry[];
};

export type ErrorResponse = {
  error: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ChatRequest = {
  message: string;
};

export type ChatAddEntryAction = {
  type: "add_entry";
  entry: CalorieEntry;
};

export type ChatDeleteEntryAction = {
  type: "delete_entry";
  entry_id: string;
  deleted: true;
};

export type ChatEditEntryAction = {
  type: "edit_entry";
  entry: CalorieEntry;
};

export type ChatAction = ChatAddEntryAction | ChatDeleteEntryAction | ChatEditEntryAction;

export type ChatResponse = {
  reply: string;
  actions: ChatAction[];
};
