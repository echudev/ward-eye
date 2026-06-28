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
  PALETTE,
} from "./theme";

function dominantQueue(trends: PlayerTrend[]): PlayerTrend[] {
  if (trends.length === 0) return [];
  const games = new Map<number, number>();
  for (const t of trends) games.set(t.queue_id, (games.get(t.queue_id) ?? 0) + t.games);
  let best = trends[0].queue_id;
  let bestN = -1;
  for (const [q, n] of games) if (n > bestN) [best, bestN] = [q, n];
  return trends.filter((t) => t.queue_id === best);
}

export default function TrendsResourcesChart({ trends }: { trends: PlayerTrend[] }) {
  const option = useMemo<EChartsOption>(() => {
    const rows = dominantQueue(trends);
    return {
      ...baseOption,
      color: PALETTE,
      tooltip: tooltip("axis"),
      legend: {
        data: ["CS/min", "Visión/min", "Daño/min"],
        textStyle: { color: MUTED },
        top: 8,
      },
      xAxis: { ...categoryAxis(), data: rows.map((r) => r.week_start) },
      yAxis: [
        valueAxis("CS / Vis"),
        valueAxis("Daño/min", { position: "right", splitLine: { show: false } }),
      ],
      series: [
        {
          name: "CS/min",
          type: "line",
          yAxisIndex: 0,
          smooth: true,
          data: rows.map((r) => r.avg_cs_per_min),
        },
        {
          name: "Visión/min",
          type: "line",
          yAxisIndex: 0,
          smooth: true,
          data: rows.map((r) => r.avg_vision_per_min),
        },
        {
          name: "Daño/min",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          data: rows.map((r) => r.avg_damage_per_min),
        },
      ],
    };
  }, [trends]);

  return <EChart option={option} />;
}
