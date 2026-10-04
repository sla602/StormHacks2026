export const EMPTY_CASE = {
  id: "custom",
  title: "",
  prompt: "",
  urgency: "Routine",
  payload_tokens: 5000,
  description: "",
};

export default function AskWindow({ presets, form, setForm, onSubmit, busy, theme }) {
  const selected = presets.find((p) => p.id === form.id);

  function submit(e) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form className="window" onSubmit={submit}>
      <div className="window-bar">
        <span>{theme === "terminal" ? "> council.query" : "Ask the council"}</span>
        <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
      </div>

      <div className="window-body">
        <label htmlFor="prompt" className="sr-only">What should the AI do?</label>
        <textarea
          id="prompt"
          rows={4}
          value={form.prompt}
          disabled={busy}
          placeholder="What should the AI do? e.g. Summarize 200 customer reviews and suggest three product improvements."
          onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit();
          }}
        />

        <div className="examples">
          <span className="muted small">Try an example:</span>
          {presets.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={form.id === p.id} disabled={busy}
                    onClick={() => setForm({ ...p })}>
              {p.title}
            </button>
          ))}
          {form.id !== "custom" && (
            <button type="button" className="chip" disabled={busy} onClick={() => setForm(EMPTY_CASE)}>
              Clear
            </button>
          )}
        </div>
        {selected && <p className="muted small">💡 {selected.description}</p>}

        <details className="advanced">
          <summary>Case details</summary>
          <label>
            Title (optional)
            <input type="text" value={form.title} disabled={busy} placeholder="Defaults to the start of your question"
                   onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            Simulated job size in tokens (1k tokens ≈ 1 g on the full model)
            <input type="number" min="100" max="1000000" step="100" value={form.payload_tokens} disabled={busy}
                   onChange={(e) => setForm({ ...form, payload_tokens: e.target.value })} />
          </label>
        </details>

        <div className="window-actions">
          <label className="inline">
            <input type="checkbox" checked={form.urgency === "Emergency"} disabled={busy}
                   onChange={(e) => setForm({ ...form, urgency: e.target.checked ? "Emergency" : "Routine" })} />
            Emergency
          </label>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Council in session…" : "Convene council"}
          </button>
        </div>
      </div>
    </form>
  );
}