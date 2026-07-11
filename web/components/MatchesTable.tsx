import type { MatchPerformance } from "@/lib/types";

export function MatchesTable({ matches }: { matches: MatchPerformance[] }) {
  const rows = matches.slice(0, 15);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.1em] text-primary">
          <tr className="border-b border-line">
            <th className="py-2 pr-3 font-medium">Fecha</th>
            <th className="py-2 pr-3 font-medium">Res</th>
            <th className="py-2 pr-3 font-medium">Campeón</th>
            <th className="py-2 pr-3 font-medium">Pos</th>
            <th className="py-2 pr-3 font-medium">KDA</th>
            <th className="py-2 pr-3 font-medium text-right">CS/min</th>
            <th className="py-2 pr-3 font-medium text-right">Vis/min</th>
            <th className="py-2 pr-3 font-medium text-right">Dmg/min</th>
            <th className="py-2 pr-3 font-medium text-right">KP</th>
          </tr>
        </thead>
        <tbody className="text-muted">
          {rows.map((m) => (
            <tr
              key={m.match_id}
              className="border-b border-line/60 hover:bg-primary/5"
            >
              <td className="py-2 pr-3">{m.game_date}</td>
              <td
                className={`py-2 pr-3 font-bold ${m.win ? "text-primary" : "text-danger"}`}
              >
                {m.win ? "V" : "D"}
              </td>
              <td className="py-2 pr-3 font-medium text-fg">
                {m.champion_name}
              </td>
              <td className="py-2 pr-3">{m.team_position ?? "—"}</td>
              <td className="py-2 pr-3">
                {m.kills}/{m.deaths}/{m.assists}{" "}
                <span className="text-muted/60">({m.kda_ratio.toFixed(2)})</span>
              </td>
              <td className="py-2 pr-3 text-right">
                {m.cs_per_min.toFixed(1)}
              </td>
              <td className="py-2 pr-3 text-right">
                {m.vision_per_min.toFixed(2)}
              </td>
              <td className="py-2 pr-3 text-right">
                {Math.round(m.damage_per_min)}
              </td>
              <td className="py-2 pr-3 text-right">
                {Math.round(m.kill_participation * 100)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
