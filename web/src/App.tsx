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

export default function App() {
  const [summary, setSummary] = useState<DailySummaryResponse | null>(null);
  const [note, setNote] = useState("");
  const [calories, setCalories] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadTodaySummary() {
    setLoading(true);
    setError(null);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim(), calories: Number(calories) }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create entry (${response.status})`);
      }

      setNote("");
      setCalories("");
      await loadTodaySummary();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entryId: string) {
    setError(null);

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

  return (
    <main className="page">
      <section className="card">
        <h1>Calorie Tracker</h1>

        {error ? <p className="error">{error}</p> : null}

        {loading || !summary ? (
          <p className="muted">Loading today&apos;s summary...</p>
        ) : (
          <>
            <p className="muted">{summary.day} ({summary.timezone})</p>
            <div className="stats">
              <p>Budget: {summary.budget_calories}</p>
              <p>Consumed: {summary.consumed_calories}</p>
              <p>Remaining: {summary.remaining_calories}</p>
            </div>

            <form onSubmit={(event) => void handleSubmit(event)} className="form">
              <label>
                Note
                <input
                  required
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={120}
                />
              </label>

              <label>
                Calories
                <input
                  required
                  type="number"
                  min="1"
                  value={calories}
                  onChange={(event) => setCalories(event.target.value)}
                />
              </label>

              <button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Add Entry"}
              </button>
            </form>

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
          </>
        )}
      </section>
    </main>
  );
}
