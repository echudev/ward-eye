"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { JungleMatchup } from "@/lib/types";
import EChart from "../EChart";
import { baseOption, categoryAxis, valueAxis, MUTED, TEXT, AXIS_LINE, WIN, LOSS } from "./theme";

/**
 * Diferencial de campamentos contra el jungla rival al minuto 15, una barra por
 * partida. Es una escala con polaridad (arriba de 0 vas ganando el duelo, abajo
 * lo vas perdiendo), así que el color codifica el signo, no la identidad.
 *
 * Una sola medida en el eje a propósito: el oro tiene otra escala y meterlo en
 * un segundo eje y haría que dos series con unidades distintas parezcan
 * comparables. Va al tooltip, junto al resto del contexto de la partida.
 */
function label(r: JungleMatchup): string {
  const d = r.game_start_at ? r.game_start_at.slice(5, 10) : "";
  return `${d} vs ${r.enemy_champion}`;
}

export default function JungleMatchupChart({
  matchup,
}: {
  matchup: JungleMatchup[];
}) {
  const option = useMemo<EChartsOption>(() => {
    const rows = [...matchup].reverse(); // de más vieja a más nueva

    return {
      ...baseOption,
      legend: { show: false }, // una sola serie: el título ya la nombra
      tooltip: {
        trigger: "item",
        backgroundColor: "#141416",
        borderColor: AXIS_LINE,
        textStyle: { color: TEXT },
        formatter: (p: unknown) => {
          const i = (p as { dataIndex: number }).dataIndex;
          const r = rows[i];
          if (!r) return "";
          const sign = (n: number | null) =>
            n === null ? "sin dato" : n > 0 ? `+${n}` : `${n}`;
          return [
            `<b>${r.my_champion} vs ${r.enemy_champion}</b>`,
            `${r.win ? "Victoria" : "Derrota"} · ${r.game_start_at?.slice(0, 10) ?? ""}`,
            `Campamentos @15: <b>${sign(r.camp_diff_at_15)}</b>`,
            `Campamentos @10: ${sign(r.camp_diff_at_10)}`,
            `Oro @15: ${sign(r.gold_diff_at_15)}`,
            `Wards: ${r.my_wards} vs ${r.enemy_jungler_wards}`,
            `Muertes en duelo: ${r.deaths_solo}/${r.deaths_total}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        ...categoryAxis(),
        data: rows.map(label),
        axisLabel: { color: MUTED, rotate: 45, fontSize: 10, hideOverlap: true },
      },
      yAxis: valueAxis("Campamentos vs rival @15"),
      series: [
        {
          name: "Diferencial de campamentos @15",
          type: "bar",
          barMaxWidth: 18,
          data: rows.map((r) => {
            const v = r.camp_diff_at_15;
            return {
              value: v,
              itemStyle: {
                color: (v ?? 0) >= 0 ? WIN : LOSS,
                opacity: 0.85,
                // extremo redondeado del lado opuesto a la línea de cero
                borderRadius: (v ?? 0) >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
              },
            };
          }),
          markLine: {
            silent: true,
            symbol: "none",
            data: [{ yAxis: 0 }],
            lineStyle: { color: AXIS_LINE, width: 1 },
            label: { show: false },
          },
        },
      ],
    };
  }, [matchup]);

  return <EChart option={option} />;
}
