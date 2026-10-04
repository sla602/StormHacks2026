export const CUSTOM_CASE = {
  id: "custom",
  title: "",
  prompt: "",
  urgency: "Routine",
  payload_tokens: 5000,
  description: "",
};

export default function CaseForm({ presets, form, setForm, onSubmit, busy }) {
  const idx = presets.findIndex((p) => p.id === form.id);
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  function choose(e) {
    const i = Number(e.target.value);
    setForm(i < 0 ? CUSTOM_CASE : { ...presets[i] });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2>Case</h2>
      <label>
        Start from
        <select value={idx} onChange={choose} disabled={busy}>
          <option value={-1}>Write my own case</option>
          {presets.map((p, i) => (
            <option key={p.id} value={i}>Example: {p.title}</option>
          ))}
        </select>
      </label>
      {idx >= 0 && <p className="muted small">💡 {presets[idx].description}</p>}

      <label>
        Case title
        <input type="text" value={form.title} onChange={update("title")} disabled={busy}
               placeholder="e.g. Summarize our customer feedback survey" />
      </label>
      <label>
        What should the AI do? (this text is sent to the model)
        <textarea rows={4} value={form.prompt} onChange={update("prompt")} disabled={busy} />
      </label>

      <div className="row">
        <fieldset disabled={busy}>
          <legend>Urgency</legend>
          {["Routine", "Emergency"].map((u) => (
            <label key={u} className="inline">
              <input type="radio" name="urgency" value={u} checked={form.urgency === u} onChange={update("urgency")} />
              {u}
            </label>
          ))}
        </fieldset>
        <label>
          Simulated job size (tokens)
          <input type="number" min="100" max="1000000" step="100" value={form.payload_tokens}
                 onChange={update("payload_tokens")} disabled={busy} />
          <span className="muted small"> 1k tokens ≈ 1 g on the FULL model</span>
        </label>
      </div>

      <button type="submit" disabled={busy}>{busy ? "Council in session…" : "Convene council"}</button>
    </form>
  );
}
