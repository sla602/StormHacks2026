const ICON = { APPROVE: "⭕", REJECT: "❌", ABSTAIN: "⚪" };

export default function VoteBoard({ agents, order, votes, revealed }) {
  return (
    <div className="grid">
      {order.map((key, i) => {
        const agent = agents[key];
        const vote = votes.find((v) => v.agent === key);
        const shown = vote && i < revealed;
        return (
          <div className="card" key={key}>
            <strong>{agent.emoji} {agent.name}</strong>
            {shown ? (
              <>
                <p>{ICON[vote.vote]} <b>{vote.vote}</b> (suggests {vote.suggested_action})</p>
                <p>{vote.reason}</p>
                {vote.source !== "llm" && <p className="muted small">Rule-based fallback: {vote.error}</p>}
              </>
            ) : (
              <p className="muted">Deliberating…</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
