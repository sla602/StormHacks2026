const COLUMNS = [
  ["time", "Time"],
  ["task", "Case"],
  ["urgency", "Urgency"],
  ["tally", "Votes"],
  ["tally_action", "Majority"],
  ["final_action", "Final"],
  ["model", "Model"],
  ["co2_charged_g", "CO₂ (g)"],
  ["co2_used_total_g", "Total (g)"],
];

export default function History({ history }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            {COLUMNS.map(([k, label]) => <th key={k}>{label}</th>)}
          </tr>
        </thead>
        <tbody>
          {history.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              {COLUMNS.map(([k]) => <td key={k}>{String(row[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}