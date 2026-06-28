"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { MatchPerformance } from "@/lib/types";
import EChart from "../EChart";
import { baseOption, valueAxis, tooltip, MUTED, WIN, LOSS } from "./theme";

type Point = {
  value: [number, number];
  champion: string;
  kda: number;
};

function points(matches: MatchPerformance[], win: boolean): Point[] {
  return matches
    .filter((m) => m.win === win)
    .map((m) => ({
      value: [
        Math.round(m.damage_share * 100),
        Math.round(m.kill_participation * 100),
      ],
      champion: m.champion_name,
      kda: m.kda_ratio,
    }));
}

export default function ImpactScatterChart({
  matches,
}: {
  matches: MatchPerformance[];
}) {
  const option = useMemo<EChartsOption>(() => {
    return {
      ...baseOption,
      tooltip: {
        ...tooltip("item"),
        formatter: (p: unknown) => {
          const d = p as { data: Point };
          return `${d.data.champion}<br/>Daño: ${d.data.value[0]}% · KP: ${d.data.value[1]}%<br/>KDA: ${d.data.kda}`;
        },
      },
      legend: {
        data: ["Victorias", "Derrotas"],
        textStyle: { color: MUTED },
        top: 8,
      },
      xAxis: valueAxis("Daño share %", { min: 0 }),
      yAxis: valueAxis("Kill participation %", { min: 0, max: 100 }),
      series: [
        {
          name: "Victorias",
          type: "scatter",
          symbolSize: 13,
          data: points(matches, true),
          itemStyle: { color: WIN, opacity: 0.8 },
        },
        {
          name: "Derrotas",
          type: "scatter",
          symbolSize: 13,
          data: points(matches, false),
          itemStyle: { color: LOSS, opacity: 0.8 },
        },
      ],
    };
  }, [matches]);

  return <EChart option={option} />;
}
