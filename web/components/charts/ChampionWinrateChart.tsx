"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { ChampionStat } from "@/lib/types";
import EChart from "../EChart";
import { baseOption, categoryAxis, valueAxis, tooltip, WIN, LOSS } from "./theme";

export default function ChampionWinrateChart({
  champions,
}: {
  champions: ChampionStat[];
}) {
  const option = useMemo<EChartsOption>(() => {
    // mayor cantidad de partidas arriba → orden inverso para el eje horizontal
    const rows = [...champions].slice(0, 12).reverse();
    return {
      ...baseOption,
      grid: { left: 16, right: 56, top: 24, bottom: 24, containLabel: true },
      tooltip: {
        ...tooltip("item"),
        formatter: (p: unknown) => {
          const d = p as { name: string; value: number; dataIndex: number };
          const c = rows[d.dataIndex];
          return `${d.name}<br/>WR: ${d.value.toFixed(2)}% (${c.wins}W / ${c.losses}L)<br/>KDA: ${c.avg_kda.toFixed(2)} · CS/min: ${c.avg_cs_per_min.toFixed(2)}`;
        },
      },
      xAxis: valueAxis("Winrate %", { min: 0, max: 100 }),
      yAxis: { ...categoryAxis(), data: rows.map((c) => `${c.champion_name} (${c.games_played})`) },
      series: [
        {
          type: "bar",
          data: rows.map((c) => ({
            value: c.winrate_pct,
            itemStyle: {
              color: c.winrate_pct >= 50 ? WIN : LOSS,
              borderRadius: [0, 3, 3, 0],
            },
          })),
          label: {
            show: true,
            position: "right",
            formatter: "{c}%",
            color: "#a1a1aa",
          },
        },
      ],
    };
  }, [champions]);

  return <EChart option={option} height={380} />;
}
