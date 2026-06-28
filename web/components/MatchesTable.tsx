import type { MatchPerformance } from "@/lib/types";

export function MatchesTable({ matches }: { matches: MatchPerformance[] }) {
  const rows = matches.slice(0, 15);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500">
          <tr className="border-b border-zinc-800">
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
        <tbody className="text-zinc-300">
          {rows.map((m) => (
            <tr key={m.match_id} className="border-b border-zinc-900">
              <td className="py-2 pr-3 text-zinc-400">{m.game_date}</td>
              <td className={`py-2 pr-3 font-semibold ${m.win ? "text-emerald-400" : "text-red-400"}`}>
                {m.win ? "W" : "L"}
              </td>
              <td className="py-2 pr-3 text-zinc-100">{m.champion_name}</td>
              <td className="py-2 pr-3 text-zinc-400">{m.team_position ?? "—"}</td>
              <td className="py-2 pr-3">
                {m.kills}/{m.deaths}/{m.assists}{" "}
                <span className="text-zinc-500">({m.kda_ratio})</span>
              </td>
              <td className="py-2 pr-3 text-right">{m.cs_per_min.toFixed(1)}</td>
              <td className="py-2 pr-3 text-right">{m.vision_per_min.toFixed(2)}</td>
              <td className="py-2 pr-3 text-right">{Math.round(m.damage_per_min)}</td>
              <td className="py-2 pr-3 text-right">{Math.round(m.kill_participation * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
