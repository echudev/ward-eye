"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { MatchPerformance } from "@/lib/types";
import EChart from "../EChart";
import {
  baseOption,
  categoryAxis,
  valueAxis,
  tooltip,
  MUTED,
  WIN,
  LOSS,
} from "./theme";

export default function KdaTimelineChart({
  matches,
}: {
  matches: MatchPerformance[];
}) {
  const option = useMemo<EChartsOption>(() => {
    // de más vieja a más nueva
    const rows = [...matches].reverse();
    return {
      ...baseOption,
      tooltip: tooltip("axis"),
      legend: {
        data: ["Kills", "Deaths", "Assists", "KDA"],
        textStyle: { color: MUTED },
        top: 8,
      },
      xAxis: {
        ...categoryAxis(),
        data: rows.map((m) => `${m.game_date.slice(5)} ${m.champion_name}`),
        axisLabel: { color: MUTED, rotate: 45, fontSize: 10, hideOverlap: true },
      },
      yAxis: [
        valueAxis("K / D / A"),
        valueAxis("KDA", { position: "right", splitLine: { show: false } }),
      ],
      series: [
        {
          name: "Kills",
          type: "bar",
          stack: "kda",
          data: rows.map((m) => m.kills),
          itemStyle: { color: WIN },
        },
        {
          name: "Deaths",
          type: "bar",
          stack: "kda",
          data: rows.map((m) => m.deaths),
          itemStyle: { color: LOSS },
        },
        {
          name: "Assists",
          type: "bar",
          stack: "kda",
          data: rows.map((m) => m.assists),
          itemStyle: { color: "#60a5fa" },
        },
        {
          name: "KDA",
          type: "line",
          yAxisIndex: 1,
          smooth: true,
          symbolSize: 6,
          data: rows.map((m) => m.kda_ratio),
          itemStyle: { color: "#f59e0b" },
          lineStyle: { color: "#f59e0b" },
        },
      ],
    };
  }, [matches]);

  return <EChart option={option} />;
}
