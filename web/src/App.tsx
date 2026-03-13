import { FormEvent, useEffect, useState } from "react";

type CalorieEntry = {
  id: string;
  note: string;
  calories: number;
  consumed_at: string;
  day: string;
};

type DailySummaryResponse = {
  day: string;
  timezone: string;
  rollover_hour_local: 4;
  budget_calories: number;
  consumed_calories: number;
  remaining_calories: number;
  entries: CalorieEntry[];
};

type ChatAddEntryAction = {
  type: "add_entry";
  entry: CalorieEntry;
};

type ChatDeleteEntryAction = {
  type: "delete_entry";
  entry_id: string;
  deleted: true;
};

type ChatAction = ChatAddEntryAction | ChatDeleteEntryAction;

type ChatResponse = {
  reply: string;
  actions: ChatAction[];
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

const CHAT_HISTORY_STORAGE_KEY = "chat_history_v1";

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { role?: unknown; text?: unknown };
  return (
    (candidate.role === "user" || candidate.role === "assistant") &&
    typeof candidate.text === "string"
  );
}

function loadChatHistory(): ChatMessage[] {
  try {
    const raw =
      typeof window !== "undefined" ? window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) : null;
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isChatMessage);
  } catch {
    return [];
  }
}

export default function App() {
  const [summary, setSummary] = useState<DailySummaryResponse | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [loading, setLoading] = useState(true);
  const [chatSending, setChatSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  async function loadTodaySummary() {
    setLoading(true);

    try {
      const response = await fetch("/days/today");
      if (!response.ok) {
        throw new Error(`Failed to fetch summary (${response.status})`);
      }

      const data = (await response.json()) as DailySummaryResponse;
      setSummary(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTodaySummary();
  }, []);

  useEffect(() => {
    if (chatMessages.length === 0) {
      window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chatMessages));
  }, [chatMessages]);

  async function handleChatSubmit(event: FormEvent) {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message) {
      return;
    }

    setChatSending(true);
    setChatError(null);
    setChatMessages((prev) => [...prev, { role: "user", text: message }]);
    setChatInput("");

    try {
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send chat message (${response.status})`);
      }

      const data = (await response.json()) as ChatResponse;
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.reply,
        },
      ]);
    } catch (err) {
      const chatMessage = err instanceof Error ? err.message : "Unexpected error";
      setChatError(chatMessage);
    } finally {
      await loadTodaySummary();
      setChatSending(false);
    }
  }

  async function handleDelete(entryId: string) {
    setError(null);
    if (!window.confirm("Delete this entry?")) {
      return;
    }

    try {
      const response = await fetch(`/entries/${entryId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(`Failed to delete entry (${response.status})`);
      }

      await loadTodaySummary();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    }
  }

  function handleClearChat() {
    setChatMessages([]);
    setChatError(null);
  }

  const budgetCalories = summary?.budget_calories ?? 0;
  const consumedCalories = summary?.consumed_calories ?? 0;
  const basePercent =
    budgetCalories > 0 ? Math.min(consumedCalories / budgetCalories, 1) * 100 : 0;
  const overflowPercent =
    budgetCalories > 0 ? Math.max((consumedCalories - budgetCalories) / budgetCalories, 0) * 100 : 0;
  const overflowPercentCapped = Math.min(overflowPercent, 150);
  const progressNow = budgetCalories > 0 ? Math.min(consumedCalories, budgetCalories) : 0;
  const budgetDisplay = budgetCalories.toLocaleString();
  const consumedDisplay = consumedCalories.toLocaleString();
  const remainingDisplay = (summary?.remaining_calories ?? 0).toLocaleString();
  const parsedDay = summary ? new Date(summary.day) : null;
  const formattedDay =
    parsedDay && !Number.isNaN(parsedDay.getTime())
      ? parsedDay.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : summary?.day ?? "";
  const hasChatHistory = chatMessages.length > 0;
  const latestChatMessage = hasChatHistory ? chatMessages[chatMessages.length - 1] : null;

  return (
    <main className="page">
      <section className="card">
        {error ? <p className="error">{error}</p> : null}
        {chatError ? <p className="error">{chatError}</p> : null}

        {loading || !summary ? (
          <p className="muted">Loading today&apos;s summary...</p>
        ) : (
          <>
            <section className="panel">
              <div className="chat-header">
                <h2>Chat</h2>
                {hasChatHistory ? (
                  <span className="history-badge">History: {chatMessages.length}</span>
                ) : null}
              </div>
              <div className="chat-line" aria-live="polite">
                {latestChatMessage ? (
                  <>
                    <span className={`chat-role ${latestChatMessage.role}`}>
                      {latestChatMessage.role.toUpperCase()}
                    </span>
                    <span className="chat-text">{latestChatMessage.text}</span>
                  </>
                ) : (
                  <span className="chat-text muted">No chat history yet.</span>
                )}
              </div>

              <form onSubmit={(event) => void handleChatSubmit(event)} className="chat-form">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a quick request..."
                  maxLength={2000}
                  disabled={chatSending}
                />
                <div className="chat-actions">
                  <button type="submit" disabled={chatSending || chatInput.trim().length === 0}>
                    {chatSending ? "Sending..." : "Send"}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearChat}
                    disabled={chatSending || !hasChatHistory}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </section>

            <section className="panel">
              <h2>Today</h2>
              <p className="today-date-badge">{formattedDay}</p>
              <div className="progress-container">
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={budgetCalories}
                  aria-valuenow={progressNow}
                  aria-label="Calories consumed toward daily budget"
                >
                  <div className="progress-fill" style={{ width: `${basePercent}%` }} />
                  {overflowPercentCapped > 0 ? (
                    <div
                      className="progress-overflow"
                      style={{ width: `${overflowPercentCapped}%` }}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              </div>
              <div className="today-metrics">
                <article className="metric-tile metric-budget">
                  <p className="metric-label">Budget</p>
                  <p className="metric-value">{budgetDisplay}</p>
                </article>
                <article className="metric-tile metric-consumed">
                  <p className="metric-label">Consumed</p>
                  <p className="metric-value">{consumedDisplay}</p>
                </article>
                <article className="metric-tile metric-remaining">
                  <p className="metric-label">Remaining</p>
                  <p className="metric-value">{remainingDisplay}</p>
                </article>
              </div>
            </section>

            <section className="panel">
              <h2>Entries</h2>
              {summary.entries.length > 0 ? (
                <ul className="entries">
                  {summary.entries.map((entry) => (
                    <li key={entry.id}>
                      <div className="entry-meta">
                        <div className="entry-head">
                          <p className="entry-note">{entry.note}</p>
                          <p className="entry-time">
                            {new Date(entry.consumed_at).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <p className="entry-calories">{entry.calories} calories</p>
                      </div>
                      <div className="entry-actions">
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void handleDelete(entry.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
