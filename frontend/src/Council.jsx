import { useLayoutEffect, useRef, useState } from "react";

// Otter theme pictures: put your files in frontend/public/otters/ with these names.
export const PICTURES = {
  ask: "/otters/yellow.png",
  business: "/otters/blue.png",
  eco: "/otters/pink.png",
  ethics: "/otters/green.png",
};
// Terminal theme emoji.
export const EMOJI = { ask: "💬", business: "🏢", eco: "🌿", ethics: "⚖️" };

export const EMPTY_CASE = { id: "custom", title: "", prompt: "", urgency: "Routine", payload_tokens: 5000 };

// Every word that changes with the theme. Past sessions are re-rendered from raw data,
// so switching themes relabels everything on screen at once.
export const TEXT = {
  terminal: {
    tagline: "Planning to use AI for a business task? The council finds a way to do it that cuts carbon without giving up the business value.",
    how: [
      "Describe what your company wants AI to do.",
      "Business, Environment and Tech & Ethics agents each vote and propose a win-win idea.",
      "Get the majority verdict and a plan that saves carbon while keeping what the business needs.",
    ],
    role: { business: "Business", eco: "Environment", ethics: "Tech & Ethics" },
    narrator: "Narrator",
    vote: { APPROVE: "APPROVE", REJECT: "REJECT", ABSTAIN: "ABSTAIN" },
    thinking: "THINKING",
    thinkingNote: "Weighing the facts",
    action: {
      FULL: ["FULL", "Run at full quality"],
      DOWNGRADE: ["DOWNGRADE", "Switch to the lightweight model"],
      CACHE: ["CACHE", "Reuse a cached answer"],
      BLOCK: ["BLOCK", "Stop: over today's budget"],
    },
    urgency: { Routine: "Routine", Emergency: "Emergency" },
    tally: (a, r, x) => `${a} approve, ${r} reject, ${x} abstain`,
    verdict: "Verdict",
    deliberating: "Deliberating",
    votesIn: "Votes in",
    failed: "The council could not meet",
    askTitle: "Your company's AI task",
    askLabel: "What does your company want to do with AI?",
    askHelp: "Say what the work is for and how often it runs. The council will look for a way to do it that keeps the business value and emits less carbon.",
    placeholder: "e.g. Every night, use AI to summarize 5,000 customer support tickets so the product team can spot recurring issues.",
    examples: "Or try an example",
    emergency: "Emergency (security, safety or a legal deadline: may go over the carbon budget)",
    convene: "Convene council",
    newQuestion: "New question",
    back: "Back to the last verdict",
    plan: "Win-win plan",
    idea: "Win-win idea",
    arguments: "Full arguments",
    result: "Result",
    working: "Running the request and recording the voices",
    audio: "Council audio",
    voices: "Individual voices",
    history: "History",
    clear: "Clear",
    cols: ["Time", "Case", "Urgency", "Votes", "Final", "Model", "CO₂ (g)", "Total (g)"],
    emptyTask: "Type a task for the council first.",
    gauge: (used, q) => `CO₂ today: ${used} / ${q} g (estimated)`,
    over: (g) => `, over by ${g} g after an emergency exception`,
    facts: (c) => `Estimated CO₂: full model ${c.est_full} g, lightweight ${c.est_lite} g. Remaining today: ${c.remaining.toFixed(1)} g.`,
    details: "Case details",
    titleLabel: "Short title (optional)",
    titlePlaceholder: "Defaults to the start of your task",
    titleHelp: "Shown in the history table and read aloud at the start of the session.",
    sizeLabel: "How big is the job? (tokens)",
    sizeHelp: "This demo doesn't upload real files, so set the size of the work here. Bigger jobs emit more: about 1 g of CO₂ per 1,000 tokens on the full-quality model, and a quarter of that on the lightweight one. A short email is about 500 tokens; a 50-page report is about 40,000.",
    set: {
      budget: (q) => `Daily carbon budget: ${q} g CO₂`,
      budgetHelp: "How much CO₂ your company allows AI work to emit today, shared by every request. A lower budget makes the council stricter: big jobs get switched to a lighter model, a cached answer, or blocked. For a demo, set it to 20-30 g to see the emergency exception in action.",
      peak: "Peak electricity hours",
      peakHelp: "Simulates running the job when the power grid is busiest and electricity is dirtier. Estimated emissions go up 1.5x, so the council is more likely to suggest a lighter model or running the job later.",
      voice: "Read the session aloud",
      voiceHelp: "ElevenLabs voices read the case, every agent's argument and idea, and the final verdict. Each agent has its own voice, and the voices change with the theme. Each session uses ElevenLabs credits, so turn this off for practice runs.",
      noVoice: " Unavailable: ELEVENLABS_API_KEY is not set.",
      about: (cfg) => `Agents: ${cfg.offline ? "offline mode, rule-based votes (no Gemini calls)" : "Gemini API"}. Full-quality model: ${cfg.models.full}. Lightweight model: ${cfg.models.lite}. All carbon figures are estimates for the demo, not measurements.`,
      reset: "Reset today's budget and history",
      resetHelp: "Sets today's CO₂ usage back to 0 g and clears the history table.",
    },
  },
  otter: {
    tagline: "Want AI to help with something? Ask the otters! They find a way that's fun for you and kind to the planet.",
    how: [
      "Tell the otters what you want AI to do.",
      "Three otters each say yes or nope, and share an idea.",
      "You get their answer and an easy plan.",
    ],
    role: { business: "Shop Keeper", eco: "Earth Buddy", ethics: "Fair Play" },
    narrator: "Storyteller",
    vote: { APPROVE: "YES!", REJECT: "NOPE", ABSTAIN: "PASS" },
    thinking: "THINKING...",
    thinkingNote: "Hmm, let me think",
    action: {
      FULL: ["Go big!", "Use the super smart AI"],
      DOWNGRADE: ["Go light!", "Use the little AI and save energy"],
      CACHE: ["Reuse it!", "Use an answer we already have"],
      BLOCK: ["Stop!", "Too big for today"],
    },
    urgency: { Routine: "Normal", Emergency: "Super urgent" },
    tally: (a, r, x) => `${a} yes, ${r} nope, ${x} pass`,
    verdict: "The otters say",
    deliberating: "The otters are chatting",
    votesIn: "Votes so far",
    failed: "The otters couldn't meet",
    askTitle: "Ask the otters",
    askLabel: "What should AI help with?",
    askHelp: "Tell us the job in a sentence or two.",
    placeholder: "e.g. Write a fun invitation for my friend's birthday picnic.",
    examples: "Or try one:",
    emergency: "It's super urgent!",
    convene: "Ask the otters",
    newQuestion: "Ask again",
    back: "See the last answer",
    plan: "Everybody-wins plan",
    idea: "Idea",
    arguments: "What each otter said",
    result: "What the AI made",
    working: "The AI is working and the otters are warming up their voices",
    audio: "Listen to the otters",
    voices: "Each otter",
    history: "Past answers",
    clear: "Clear",
    cols: ["Time", "Job", "Urgent?", "Votes", "Answer", "AI used", "Energy (g)", "Total (g)"],
    emptyTask: "Tell the otters what to do first!",
    gauge: (used, q) => `Energy used today: ${used} / ${q} g`,
    over: (g) => `, ${g} g extra for an emergency`,
    facts: (c) => `Big AI: ${c.est_full} g. Little AI: ${c.est_lite} g. Energy left today: ${c.remaining.toFixed(1)} g.`,
    details: "More options",
    titleLabel: "Give it a name (optional)",
    titlePlaceholder: "e.g. Birthday invite",
    titleHelp: "Shows up in Past answers.",
    sizeLabel: "How big is the job?",
    sizeHelp: "Bigger jobs use more energy. A short note is about 500. A long story is about 40,000.",
    set: {
      budget: (q) => `Energy for today: ${q} g`,
      budgetHelp: "How much energy AI can use today. Less energy means the otters say Go light! or Stop! more often.",
      peak: "Busy power time",
      peakHelp: "Pretend everyone is using power at once. Every job costs more, so the otters get pickier.",
      voice: "Let the otters talk",
      voiceHelp: "Hear each otter in its own voice. This uses ElevenLabs credits.",
      noVoice: " (Needs an ElevenLabs key.)",
      about: (cfg) => `Otter brains: ${cfg.offline ? "simple rules (offline)" : "Gemini"}. The numbers are pretend, just for the demo.`,
      reset: "Start fresh",
      resetHelp: "Fills today's energy back up and clears Past answers.",
    },
  },
};

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