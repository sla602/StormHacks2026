import { useEffect, useState } from "react";
import { AskWindow, EMPTY_CASE, Triad } from "./Council.jsx";
import { Audio, History, Plan, Settings } from "./Panels.jsx";
import { TEXT, THEMES } from "./themes.js";

const REVEAL_MS = 1100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- API (Vite proxies /api to FastAPI on port 8000) ----------
async function call(path, body) {
  const res = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Server returned HTTP ${res.status}`);
  return data;
}

function savedTheme() {
  try {
    const t = localStorage.getItem("eco-theme");
    return THEMES.some((x) => x.id === t) ? t : "terminal";
  } catch {
    return "terminal";
  }
}

export default function App() {
  const [theme, setTheme] = useState(savedTheme);
  const [view, setView] = useState("ask"); // ask | council
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState("");
  const [quota, setQuota] = useState(50);
  const [peak, setPeak] = useState(false);
  const [narrate, setNarrate] = useState(false);
  const [form, setForm] = useState(EMPTY_CASE);
  const [phase, setPhase] = useState("idle"); // idle | deliberating | revealing | done | error
  const [session, setSession] = useState(null); // { question, ctx, votes, verdict, plan }
  const [revealed, setRevealed] = useState(0);
  const [outcome, setOutcome] = useState(null); // { result, audio }
  const [ledger, setLedger] = useState(null);
  const [executing, setExecuting] = useState(false);

  const T = TEXT[theme];
  const busy = phase === "deliberating" || phase === "revealing" || executing;
  const presetsFor = (t) => (t === "otter" ? cfg?.presets_otter : cfg?.presets) ?? [];

  // Switch theme; if an example is selected, swap it for the matching example of the new theme
  function switchTheme(next) {
    const i = presetsFor(theme).findIndex((p) => p.id === form.id);
    const match = presetsFor(next)[i];
    if (i >= 0 && match) setForm({ ...match });
    setTheme(next);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.title = TEXT[theme].brand;
    try {
      localStorage.setItem("eco-theme", theme);
    } catch {
      /* storage unavailable: the theme just won't persist */
    }
  }, [theme]);

  // Shortcuts when you're not typing: T / O switch theme, N starts a new question
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toUpperCase();
      const t = THEMES.find((x) => x.key === k);
      if (t) switchTheme(t.id);
      if (k === "N" && view === "council" && !busy) setView("ask");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    call("/config")
      .then((c) => {
        setCfg(c);
        setQuota(c.ledger.quota);
        setNarrate(c.has_tts);
        setLedger(c.ledger);
      })
      .catch((e) => setError(`Cannot reach the backend (${e.message}). Start it with: uvicorn server:app --port 8000`));
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  async function convene() {
    if (!form.prompt.trim()) {
      setError(T.emptyTask);
      return;
    }
    setError("");
    setSession(null);
    setOutcome(null);
    setRevealed(0);
    setPhase("deliberating");
    setView("council"); // move to the council chamber right away

    try {
      const d = await call("/deliberate", {
        id: form.id, title: form.title, prompt: form.prompt, urgency: form.urgency,
        payload_tokens: Number(form.payload_tokens), peak, quota,
      });
      setSession(d);
      setPhase("revealing");
      setExecuting(true);
      // The server runs the request and records the voices (in this theme's style) while the votes are revealed
      const exec = call("/execute", { run_id: d.run_id, narrate, theme }).then((r) => ({ r }), (e) => ({ e }));
      for (let i = 1; i <= d.votes.length; i++) {
        await sleep(REVEAL_MS);
        setRevealed(i);
      }
      setPhase("done");
      const { r, e } = await exec;
      if (e) throw e;
      setOutcome(r);
      setLedger(r.ledger);
    } catch (e) {
      setError(e.message);
      setPhase((p) => (p === "deliberating" ? "error" : p));
    } finally {
      setExecuting(false);
    }
  }

  async function reset() {
    try {
      setLedger(await call("/reset", {}));
      setSession(null);
      setOutcome(null);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  const used = ledger?.used ?? 0;
  const gauge = (
    <div className="gauge">
      <progress value={Math.min(used, quota)} max={quota} aria-label="Daily CO2 quota used" />
      <span className="small">
        {T.gauge(used.toFixed(1), quota)}
        {used > quota && T.over((used - quota).toFixed(1))}
      </span>
    </div>
  );

  return (
    <>
      {/* Same place in every theme and on every screen */}
      <nav className="theme-picker" aria-label="Theme">
        {THEMES.map((t) => (
          <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => switchTheme(t.id)}>
            <kbd>{t.key}</kbd> {t.label}
          </button>
        ))}
      </nav>

      {view === "ask" ? (
        <main className="view view-ask" key="ask">
          <header className="hero">
            <h1 className="brand">[ {T.brand} ]</h1>
            <p className="tagline">{T.tagline}</p>
            <ol className="how">
              {T.how.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </header>
          {gauge}
          {cfg && <AskWindow presets={presetsFor(theme)} form={form} setForm={setForm} onSubmit={convene} busy={busy} T={T} />}
          {cfg && (
            <Settings cfg={cfg} quota={quota} setQuota={setQuota} peak={peak} setPeak={setPeak}
                      narrate={narrate} setNarrate={setNarrate} onReset={reset} busy={busy} T={T} />
          )}
          {error && <p className="error" role="alert">{error}</p>}
          {session && (
            <button type="button" className="link" onClick={() => setView("council")}>{T.back}</button>
          )}
        </main>
      ) : (
        <main className="view view-council" key="council">
          <div className="council-bar">
            <button type="button" onClick={() => setView("ask")} disabled={busy}>
              <kbd>N</kbd> {T.newQuestion}
            </button>
            <p className="question">
              <span className="tag">{T.urgency[session?.ctx.urgency ?? form.urgency]}</span>{" "}
              {session?.question ?? form.prompt}
            </p>
          </div>

          <Triad order={cfg?.order ?? ["business", "eco", "ethics"]} votes={session?.votes ?? []}
                 revealed={revealed} phase={phase} verdict={session?.verdict} plan={session?.plan} T={T} />

          {error && <p className="error center" role="alert">{error}</p>}
          {session && (
            <p className="muted small center facts">{T.facts(session.ctx)}</p>
          )}

          {phase === "done" && session && <Plan session={session} order={cfg.order} T={T} />}
          {phase === "done" && executing && <p className="muted center">{T.working}</p>}

          {outcome && (
            <section className="box">
              <h2 className="box-title">{T.result}</h2>
              <p className="muted small">
                Model {outcome.result.model}, charged {outcome.result.charged_co2} g, tokens{" "}
                {outcome.result.tokens || "-"} {outcome.result.note}
              </p>
              <p className="pre">{outcome.result.text}</p>
              <Audio audio={outcome.audio} T={T} />
            </section>
          )}

          {gauge}
          {ledger?.history.length > 0 && <History history={ledger.history} T={T} />}
        </main>
      )}
    </>
  );
}