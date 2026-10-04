// Three agents on the corners of a triangle, the majority decision in the middle.
const CODENAME = { business: "ATLAS", eco: "GAIA", ethics: "THEMIS" };
const ROLE = { business: "Business", eco: "Environment", ethics: "Tech & Ethics" };
const POSITION = ["top", "left", "right"];
// Triangle corners and centre in SVG units (0-100); must match the .node-* positions in index.css
const CORNERS = [[50, 13], [18, 78], [82, 78]];
const CENTER = [50, 56];

const ACTION_TEXT = {
  FULL: "Run at full quality",
  DOWNGRADE: "Switch to the lightweight model",
  CACHE: "Reuse a cached answer",
  BLOCK: "Stop: over today's budget",
};

const STATUS = {
  terminal: { idle: "STANDBY", thinking: "ANALYZING", APPROVE: "APPROVE", REJECT: "REJECT", ABSTAIN: "ABSTAIN" },
  garden: { idle: "Resting", thinking: "Thinking…", APPROVE: "Agrees", REJECT: "Objects", ABSTAIN: "Steps back" },
};

export default function Triad({ agents, order, votes, revealed, phase, verdict, plan, theme }) {
  const words = STATUS[theme] ?? STATUS.terminal;

  return (
    <div className={`triad phase-${phase}`}>
      <svg className="triad-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon className="edge" points={CORNERS.map((c) => c.join(",")).join(" ")} />
        {order.map((key, i) => {
          const v = votes.find((x) => x.agent === key);
          const on = v && i < revealed;
          return (
            <line key={key} x1={CORNERS[i][0]} y1={CORNERS[i][1]} x2={CENTER[0]} y2={CENTER[1]}
                  className={`spoke ${on ? `on vote-${v.vote.toLowerCase()}` : ""}`} />
          );
        })}
      </svg>

      {order.map((key, i) => {
        const v = votes.find((x) => x.agent === key);
        const shown = v && i < revealed;
        const state = shown ? `voted vote-${v.vote.toLowerCase()}` : phase === "idle" ? "idle" : "thinking";
        const status = shown ? words[v.vote] : phase === "idle" ? words.idle : words.thinking;
        return (
          <article key={key} className={`node node-${POSITION[i]} ${state}`} aria-live="polite">
            <header className="node-name">
              {theme === "terminal" ? (
                <>
                  <b>{CODENAME[key]}-{i + 1}</b>
                  <span>{ROLE[key]}</span>
                </>
              ) : (
                <>
                  <span className="node-emoji" aria-hidden="true">{agents[key]?.emoji}</span>
                  <b>{ROLE[key]}</b>
                </>
              )}
            </header>
            <div className="node-status">{status}</div>
            <p className="node-summary">
              {shown ? v.summary || v.reason : phase === "idle" ? "Waiting for a question" : "Weighing the facts"}
            </p>
          </article>
        );
      })}

      <div className={`core ${phase === "done" && verdict ? `action-${verdict.action.toLowerCase()}` : ""}`}
           aria-live="polite">
        {phase === "idle" && <p className="core-wait">Ask a question to convene the council</p>}
        {phase === "deliberating" && <p className="core-wait">Deliberating</p>}
        {phase === "revealing" && <p className="core-wait">Votes in: {revealed} / {order.length}</p>}
        {phase === "done" && verdict && (
          <>
            <div className="core-action">{verdict.action}</div>
            <div className="core-text">{ACTION_TEXT[verdict.action]}</div>
            <div className="core-tally small">
              {verdict.approve} approve, {verdict.reject} reject, {verdict.abstain} abstain
            </div>
            {plan?.headline && <p className="core-plan small">{plan.headline}</p>}
          </>
        )}
      </div>
    </div>
  );
}