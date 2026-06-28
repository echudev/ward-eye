import type { Summary } from "@/lib/types";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function Kpis({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi label="Partidas" value={String(summary.total_games)} hint={`${summary.wins} victorias`} />
      <Kpi label="Winrate" value={`${summary.winrate_pct}%`} />
      <Kpi label="KDA" value={summary.avg_kda.toFixed(2)} />
      <Kpi label="CS / min" value={summary.avg_cs_per_min.toFixed(2)} />
      <Kpi label="Visión / min" value={summary.avg_vision_per_min.toFixed(2)} />
      <Kpi label="Daño / min" value={String(Math.round(summary.avg_damage_per_min))} />
    </div>
  );
}
