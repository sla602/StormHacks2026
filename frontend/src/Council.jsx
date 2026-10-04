import { useLayoutEffect, useRef, useState } from "react";
import { EMOJI, PICTURES } from "./themes.js";

export const EMPTY_CASE = { id: "custom", title: "", prompt: "", urgency: "Routine", payload_tokens: 5000 };

const POSITION = ["top", "left", "right"];

/** The picture, or a labelled placeholder until the file exists. */
function Picture({ src, alt }) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <span className="picture placeholder" role="img" aria-label={`${alt} (image not added yet)`}>
        <b>Image slot</b>
        <code>public{src}</code>
      </span>
    );
  }
  return <img className="picture" src={src} alt={alt} onError={() => setMissing(true)} />;
}

/** Both are rendered; CSS shows the emoji in the terminal theme and the picture in the otter theme. */
function Avatar({ who, alt }) {
  return (
    <span className={`avatar avatar-${who}`}>
      <span className="glyph" role="img" aria-label={alt}>{EMOJI[who]}</span>
      <Picture src={PICTURES[who]} alt={alt} />
    </span>
  );
}

export function AskWindow({ presets, form, setForm, onSubmit, busy, T }) {
  const selected = presets.find((p) => p.id === form.id);
  const set = (patch) => setForm({ ...form, ...patch });

  return (
    <form
      className="box ask"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="box-title">{T.askTitle}</h2>
      <div className="ask-grid">
        <Avatar who="ask" alt={T.askTitle} />
        <div>
          <label htmlFor="prompt" className="ask-label">{T.askLabel}</label>
          <p className="help">{T.askHelp}</p>
          <textarea
            id="prompt"
            rows={4}
            autoFocus
            value={form.prompt}
            disabled={busy}
            placeholder={T.placeholder}
            onChange={(e) => set({ prompt: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSubmit();
            }}
          />

          <div className="row">
            <span className="muted small">{T.examples}</span>
            <div className="tabs">
              {presets.map((p) => (
                <button key={p.id} type="button" aria-pressed={form.id === p.id} disabled={busy}
                        onClick={() => setForm({ ...p })}>
                  {p.title.replace(/\s*\(.*\)$/, "")}
                </button>
              ))}
              {form.id !== "custom" && (
                <button type="button" disabled={busy} onClick={() => setForm(EMPTY_CASE)}>{T.clear}</button>
              )}
            </div>
          </div>
          {selected && <p className="muted small">{selected.description}</p>}

          <details>
            <summary>{T.details}</summary>
            <label>
              {T.titleLabel}
              <input type="text" value={form.title} disabled={busy} placeholder={T.titlePlaceholder}
                     onChange={(e) => set({ title: e.target.value })} />
            </label>
            <p className="help">{T.titleHelp}</p>
            <label>
              {T.sizeLabel}
              <input type="number" min="100" max="1000000" step="100" value={form.payload_tokens} disabled={busy}
                     onChange={(e) => set({ payload_tokens: e.target.value })} />
            </label>
            <p className="help">{T.sizeHelp}</p>
          </details>

          <div className="row spread">
            <label className="inline">
              <input type="checkbox" checked={form.urgency === "Emergency"} disabled={busy}
                     onChange={(e) => set({ urgency: e.target.checked ? "Emergency" : "Routine" })} />
              {T.emergency}
            </label>
            <button type="submit" className="primary" disabled={busy}>
              <kbd>Ctrl+Enter</kbd> {T.convene}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

/** Three agents on the corners of a triangle, the majority decision in the middle.
 *  Layout is a CSS grid (so nothing overlaps); the connecting lines are measured from the real positions. */
export function Triad({ order, votes, revealed, phase, verdict, plan, T }) {
  const stage = useRef(null);
  const [geo, setGeo] = useState(null);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return undefined;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const mid = (selector) => {
        const node = el.querySelector(selector);
        if (!node) return null;
        const r = node.getBoundingClientRect();
        if (!r.width) return null;
        return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
      };
      const corners = order.map((k) => mid(`[data-agent="${k}"] .avatar`));
      const center = mid(".core");
      setGeo(corners.every(Boolean) && center ? { w: box.width, h: box.height, corners, center } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.querySelectorAll(".node, .core").forEach((n) => ro.observe(n));
    return () => ro.disconnect();
  }, [order, phase, revealed, T]);

  return (
    <div className={`triad phase-${phase}`} ref={stage}>
      {geo && (
        <svg className="triad-lines" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
          <polygon className="edge" points={geo.corners.map((c) => c.join(",")).join(" ")} />
          {order.map((key, i) => {
            const v = votes.find((x) => x.agent === key);
            const on = v && i < revealed;
            return (
              <line key={key} x1={geo.corners[i][0]} y1={geo.corners[i][1]} x2={geo.center[0]} y2={geo.center[1]}
                    className={on ? `spoke on is-${v.vote.toLowerCase()}` : "spoke"} />
            );
          })}
        </svg>
      )}

      {order.map((key, i) => {
        const v = votes.find((x) => x.agent === key);
        const shown = v && i < revealed;
        const state = shown ? `is-${v.vote.toLowerCase()}` : phase === "done" ? "idle" : "thinking";
        return (
          <article key={key} data-agent={key} className={`node node-${POSITION[i]} ${state}`} aria-live="polite">
            <Avatar who={key} alt={T.role[key]} />
            <div className="box node-card">
              <h3 className="box-title">{T.role[key]}</h3>
              <span className="tag">{shown ? T.vote[v.vote] : T.thinking}</span>
              <p className="node-summary">{shown ? v.summary || v.reason : T.thinkingNote}</p>
            </div>
          </article>
        );
      })}

      <div className={`core box ${phase === "done" && verdict ? `is-${verdict.action.toLowerCase()}` : ""}`}
           aria-live="polite">
        <h3 className="box-title">{T.verdict}</h3>
        {phase === "deliberating" && <p className="core-wait">{T.deliberating}</p>}
        {phase === "revealing" && <p className="core-wait">{T.votesIn}: {revealed} / {order.length}</p>}
        {phase === "done" && verdict && (
          <>
            <div className="core-action">{T.action[verdict.action][0]}</div>
            <div className="core-text">{T.action[verdict.action][1]}</div>
            <div className="small muted">{T.tally(verdict.approve, verdict.reject, verdict.abstain)}</div>
            {plan?.headline && <p className="core-plan">{plan.headline}</p>}
          </>
        )}
        {phase === "error" && <p className="core-wait">{T.failed}</p>}
      </div>
    </div>
  );
}