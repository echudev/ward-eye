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
  SECONDARY,
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

type TooltipParam = { dataIndex: number; marker: string; seriesName: string; value: number };

export default function TrendsChart({ trends }: { trends: PlayerTrend[] }) {
  const option = useMemo<EChartsOption>(() => {
    const rows = dominantQueue(trends);
    return {
      ...baseOption,
      color: PALETTE,
      tooltip: {
        ...tooltip("axis"),
        formatter: (params: unknown) => {
          const arr = params as TooltipParam[];
          if (!arr.length) return "";
          const r = rows[arr[0].dataIndex];
          const lines = arr.map(
            (p) =>
              `${p.marker}${p.seriesName}: ${p.value.toFixed(2)}${p.seriesName === "Winrate %" ? "%" : ""}`,
          );
          return [r.week_start, ...lines, `Partidas: ${r.games}`].join("<br/>");
        },
      },
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
          label: {
            show: true,
            position: "top",
            color: MUTED,
            fontSize: 10,
            formatter: (p: { dataIndex: number }) => `${rows[p.dataIndex].games}g`,
          },
        },
        {
          name: "KDA",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 7,
          data: rows.map((r) => r.avg_kda),
          itemStyle: { color: SECONDARY },
          lineStyle: { color: SECONDARY },
        },
      ],
    };
  }, [trends]);

  return <EChart option={option} />;
}
