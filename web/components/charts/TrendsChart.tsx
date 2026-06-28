"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { PlayerTrend } from "@/lib/types";
import EChart from "../EChart";
import {
  baseOption,
  categoryAxis,
  valueAxis,
  tooltip,
  MUTED,
  WIN,
  PALETTE,
} from "./theme";

/** Se queda con la cola (queue) con más partidas para no duplicar semanas. */
function dominantQueue(trends: PlayerTrend[]): PlayerTrend[] {
  if (trends.length === 0) return [];
  const games = new Map<number, number>();
  for (const t of trends) games.set(t.queue_id, (games.get(t.queue_id) ?? 0) + t.games);
  let best = trends[0].queue_id;
  let bestN = -1;
  for (const [q, n] of games) if (n > bestN) [best, bestN] = [q, n];
  return trends.filter((t) => t.queue_id === best);
}

export default function TrendsChart({ trends }: { trends: PlayerTrend[] }) {
  const option = useMemo<EChartsOption>(() => {
    const rows = dominantQueue(trends);
    return {
      ...baseOption,
      color: PALETTE,
      tooltip: tooltip("axis"),
      legend: { data: ["Winrate %", "KDA"], textStyle: { color: MUTED }, top: 8 },
      xAxis: { ...categoryAxis(), data: rows.map((r) => r.week_start) },
      yAxis: [
        valueAxis("WR %", { min: 0, max: 100 }),
        valueAxis("KDA", { position: "right", splitLine: { show: false } }),
      ],
      series: [
        {
          name: "Winrate %",
          type: "bar",
          yAxisIndex: 0,
          data: rows.map((r) => r.winrate_pct),
          itemStyle: { color: WIN, borderRadius: [3, 3, 0, 0] },
        },
        {
          name: "KDA",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 7,
          data: rows.map((r) => r.avg_kda),
        },
      ],
    };
  }, [trends]);

  return <EChart option={option} />;
}
