import type { Summary } from "@/lib/types";

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="surface-card rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-[0.14em] text-secondary">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-primary-glow">{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Kpis({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Kpi
        label="Partidas"
        value={String(summary.total_games)}
        hint={`${summary.wins} victorias`}
      />
      <Kpi label="Winrate" value={`${summary.winrate_pct}%`} />
      <Kpi label="KDA" value={summary.avg_kda.toFixed(2)} />
      <Kpi label="CS / min" value={summary.avg_cs_per_min.toFixed(2)} />
      <Kpi label="Visión / min" value={summary.avg_vision_per_min.toFixed(2)} />
      <Kpi
        label="Daño / min"
        value={String(Math.round(summary.avg_damage_per_min))}
      />
    </div>
  );
}
