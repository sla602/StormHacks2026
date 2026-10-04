import { useEffect, useState } from "react";

// The sections around the triangle: settings on the first screen, and plan / result audio / history
// on the council screen. All wording comes from T (see themes.js).

export function Settings({ cfg, quota, setQuota, peak, setPeak, narrate, setNarrate, onReset, busy, T }) {
  const S = T.set;
  return (
    <details className="settings">
      <summary>Settings</summary>

      <label>
        {S.budget(quota)}
        <input type="range" min="10" max="200" step="5" value={quota} disabled={busy}
               onChange={(e) => setQuota(Number(e.target.value))} />
      </label>
      <p className="help">{S.budgetHelp}</p>

      <label className="inline">
        <input type="checkbox" checked={peak} disabled={busy} onChange={(e) => setPeak(e.target.checked)} />
        {S.peak}
      </label>
      <p className="help">{S.peakHelp}</p>

      <label className="inline">
        <input type="checkbox" checked={narrate} disabled={busy || !cfg.has_tts}
               onChange={(e) => setNarrate(e.target.checked)} />
        {S.voice}
      </label>
      <p className="help">{S.voiceHelp}{!cfg.has_tts && S.noVoice}</p>

      <p className="help">{S.about(cfg)}</p>
      {!cfg.offline && !cfg.has_gemini_key && (
        <p className="error small">GEMINI_API_KEY is not set, so agents use rule-based fallback votes.</p>
      )}

      <button type="button" onClick={onReset} disabled={busy}>{S.reset}</button>
      <p className="help">{S.resetHelp}</p>
    </details>
  );
}

export function Plan({ session, order, T }) {
  const { plan, verdict, votes } = session;
  return (
    <section className="box">
      <h2 className="box-title">{T.plan}</h2>
      <p className="plan-headline">{plan.headline}</p>
      <ol>
        {plan.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {verdict.notes.map((n) => <p key={n} className="small">{n}</p>)}
      {plan.source !== "llm" && <p className="muted small">Template plan: {plan.error}</p>}
      <details>
        <summary>{T.arguments}</summary>
        {order.map((key) => {
          const v = votes.find((x) => x.agent === key);
          if (!v) return null;
          return (
            <div key={key} className="argument">
              <h3>{T.role[key]}: {T.vote[v.vote]}</h3>
              <p>{v.reason}</p>
              {v.win_win && <p><b>{T.idea}:</b> {v.win_win}</p>}
              {v.source !== "llm" && <p className="muted small">Rule-based fallback: {v.error}</p>}
            </div>
          );
        })}
      </details>
    </section>
  );
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function Audio({ audio, T }) {
  const [urls, setUrls] = useState(null);

  useEffect(() => {
    if (!audio || audio.error || audio.segments.length === 0) {
      setUrls(null);
      return undefined;
    }
    const parts = audio.segments.map((s) => b64ToBytes(s.audio));
    // Every clip is the same MP3 format, so they play back to back as one file
    const combined = URL.createObjectURL(new Blob(parts, { type: "audio/mpeg" }));
    const each = parts.map((p) => URL.createObjectURL(new Blob([p], { type: "audio/mpeg" })));
    setUrls({ combined, each });
    return () => {
      [combined, ...each].forEach((u) => URL.revokeObjectURL(u));
    };
  }, [audio]);

  if (!audio) return null;
  if (audio.error) return <p className="error small">Narration unavailable: {audio.error}</p>;
  if (!urls) return null;
  return (
    <div className="audio">
      <h3>{T.audio}</h3>
      <audio controls autoPlay src={urls.combined} />
      {audio.notes?.length > 0 && <p className="muted small">Voice note: {audio.notes.join("; ")}</p>}
      <details>
        <summary>{T.voices}</summary>
        {audio.segments.map((s, i) => (
          <div key={i}>
            <p className="small"><b>{T.role[s.speaker] ?? T.narrator}</b>: {s.text}</p>
            <audio controls src={urls.each[i]} />
          </div>
        ))}
      </details>
    </div>
  );
}

export function History({ history, T }) {
  const count = (row, kind) => row.votes.filter((v) => v.vote === kind).length;
  return (
    <section className="box">
      <h2 className="box-title">{T.history}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th>{T.cols.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {history.map((row, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{row.time}</td>
                <td>{row.task}</td>
                <td>{T.urgency[row.urgency] ?? row.urgency}</td>
                <td>{T.tally(count(row, "APPROVE"), count(row, "REJECT"), count(row, "ABSTAIN"))}</td>
                <td>{T.action[row.final_action]?.[0] ?? row.final_action}</td>
                <td>{row.model}</td>
                <td>{row.co2_charged_g}</td>
                <td>{row.co2_used_total_g}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a href="/api/report" download>Download audit report (JSON)</a>
    </section>
  );
}