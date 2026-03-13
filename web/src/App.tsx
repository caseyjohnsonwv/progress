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
  actions?: ChatAction[];
};

export default function App() {
  const [summary, setSummary] = useState<DailySummaryResponse | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
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
          actions: data.actions,
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
              <h2>Chat</h2>

              <div className="chat-log">
                {chatMessages.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                    <p>{message.text}</p>
                    {message.actions && message.actions.length > 0 ? (
                      <div className="chat-actions">
                        {message.actions.map((action, actionIndex) => (
                          <span key={`${action.type}-${actionIndex}`} className="action-chip">
                            {action.type === "add_entry" ? "Added entry" : "Deleted entry"}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <form onSubmit={(event) => void handleChatSubmit(event)} className="chat-form">
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Type a quick request..."
                  maxLength={2000}
                  disabled={chatSending}
                />
                <button type="submit" disabled={chatSending || chatInput.trim().length === 0}>
                  {chatSending ? "Sending..." : "Send"}
                </button>
                <button
                  type="button"
                  onClick={handleClearChat}
                  disabled={chatSending || chatMessages.length === 0}
                >
                  Clear
                </button>
              </form>
            </section>

            <section className="panel">
              <h2>Today</h2>
              <p className="muted">{summary.day}</p>
              <div className="stats">
                <p>Budget: {summary.budget_calories}</p>
                <p>Consumed: {summary.consumed_calories}</p>
                <p>Remaining: {summary.remaining_calories}</p>
              </div>
            </section>

            <section className="panel">
              <h2>Entries</h2>
              {summary.entries.length > 0 ? (
                <ul className="entries">
                  {summary.entries.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <p className="entry-note">{entry.note}</p>
                        <p className="muted">{entry.calories} calories</p>
                        <p className="muted">{new Date(entry.consumed_at).toLocaleString()}</p>
                      </div>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => void handleDelete(entry.id)}
                      >
                        Delete
                      </button>
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
