"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { EarlyGame } from "@/lib/types";
import EChart from "../EChart";
import {
  baseOption,
  categoryAxis,
  valueAxis,
  tooltip,
  MUTED,
  LOSS,
  PALETTE,
} from "./theme";

function label(e: EarlyGame): string {
  const d = e.game_start_at ? e.game_start_at.slice(5, 10) : "";
  return `${d} ${e.champion_name}`;
}

export default function EarlyGameChart({
  earlyGame,
}: {
  earlyGame: EarlyGame[];
}) {
  const option = useMemo<EChartsOption>(() => {
    const rows = [...earlyGame].reverse(); // de más vieja a más nueva
    return {
      ...baseOption,
      tooltip: tooltip("axis"),
      legend: {
        data: ["CS/min @10", "CS/min @15", "Muertes ≤15m"],
        textStyle: { color: MUTED },
        top: 8,
      },
      xAxis: {
        ...categoryAxis(),
        data: rows.map(label),
        axisLabel: { color: MUTED, rotate: 45, fontSize: 10, hideOverlap: true },
      },
      yAxis: [
        valueAxis("CS/min"),
        valueAxis("Muertes", {
          position: "right",
          splitLine: { show: false },
          minInterval: 1,
        }),
      ],
      series: [
        {
          name: "CS/min @10",
          type: "line",
          smooth: true,
          connectNulls: true,
          data: rows.map((e) => e.cs_per_min_at_10),
          itemStyle: { color: PALETTE[0] },
        },
        {
          name: "CS/min @15",
          type: "line",
          smooth: true,
          connectNulls: true,
          data: rows.map((e) => e.cs_per_min_at_15),
          itemStyle: { color: PALETTE[1] },
        },
        {
          name: "Muertes ≤15m",
          type: "bar",
          yAxisIndex: 1,
          data: rows.map((e) => e.early_deaths),
          itemStyle: { color: LOSS, opacity: 0.55 },
        },
      ],
    };
  }, [earlyGame]);

  return <EChart option={option} />;
}
