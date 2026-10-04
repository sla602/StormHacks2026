export default function SettingsPanel({ cfg, quota, setQuota, peak, setPeak, narrate, setNarrate, onReset, busy }) {
  return (
    <details className="settings">
      <summary>Settings</summary>
      <label>
        Daily CO₂ quota: {quota} g
        <input type="range" min="10" max="200" step="5" value={quota} disabled={busy}
               onChange={(e) => setQuota(Number(e.target.value))} />
      </label>
      <label className="inline">
        <input type="checkbox" checked={peak} disabled={busy} onChange={(e) => setPeak(e.target.checked)} />
        Peak electricity hours (emissions ×1.5)
      </label>
      <label className="inline">
        <input type="checkbox" checked={narrate} disabled={busy || !cfg.has_tts}
               onChange={(e) => setNarrate(e.target.checked)} />
        Read the session aloud (ElevenLabs)
      </label>
      <p className="muted small">
        Votes: {cfg.offline ? "offline, rule-based" : "Gemini API"}. Full model <code>{cfg.models.full}</code>,
        lightweight <code>{cfg.models.lite}</code>.
        {!cfg.has_tts && " Set ELEVENLABS_API_KEY to turn on audio."}
      </p>
      {!cfg.offline && !cfg.has_gemini_key && (
        <p className="error small">GEMINI_API_KEY is not set, so agents use rule-based fallback votes.</p>
      )}
      <button type="button" onClick={onReset} disabled={busy}>Reset quota and history</button>
    </details>
  );
}