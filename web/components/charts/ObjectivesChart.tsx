"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { ObjectiveControl } from "@/lib/types";
import EChart from "../EChart";
import { baseOption, categoryAxis, valueAxis, MUTED, WIN, LOSS } from "./theme";

/**
 * Winrate según quién se llevó cada objetivo. Dos series ("a favor" / "en
 * contra") sobre una única escala de porcentaje — comparable de punta a punta,
 * sin segundo eje.
 *
 * Barras horizontales a propósito: en vertical y a media anchura, ECharts
 * descartaba 2 de las 5 etiquetas de categoría por falta de espacio, y una
 * barra sin categoría legible no se puede leer. Acostadas, cada nombre entra
 * entero y sin rotar (mismo criterio que "Winrate por campeón").
 *
 * Las partidas donde el objetivo nunca cayó quedan fuera de ambas barras: no
 * son ni a favor ni en contra, y meterlas en la base diluiría el corte.
 */
type Row = { name: string; mine: ObjectiveControl[]; theirs: ObjectiveControl[] };

function wr(rows: ObjectiveControl[]): number | null {
  if (rows.length === 0) return null;
  return Math.round((rows.filter((r) => r.win).length / rows.length) * 1000) / 10;
}

export default function ObjectivesChart({
  objectives,
}: {
  objectives: ObjectiveControl[];
}) {
  const option = useMemo<EChartsOption>(() => {
    const groups: Row[] = [
      {
        name: "Primer dragón",
        mine: objectives.filter((o) => o.first_dragon_mine === true),
        theirs: objectives.filter((o) => o.first_dragon_mine === false),
      },
      {
        name: "Primer heraldo",
        mine: objectives.filter((o) => o.first_herald_mine === true),
        theirs: objectives.filter((o) => o.first_herald_mine === false),
      },
      {
        name: "Primer barón",
        mine: objectives.filter((o) => o.first_baron_mine === true),
        theirs: objectives.filter((o) => o.first_baron_mine === false),
      },
      {
        name: "Más dragones",
        mine: objectives.filter((o) => o.dragon_diff > 0),
        theirs: objectives.filter((o) => o.dragon_diff < 0),
      },
      {
        name: "Más grubs",
        mine: objectives.filter((o) => o.grub_diff > 0),
        theirs: objectives.filter((o) => o.grub_diff < 0),
      },
    ];

    const counts = new Map(
      groups.map((g) => [g.name, { mine: g.mine.length, theirs: g.theirs.length }]),
    );

    return {
      ...baseOption,
      legend: {
        data: ["A favor", "En contra"],
        textStyle: { color: MUTED },
        top: 8,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
        valueFormatter: (v: unknown) =>
          typeof v === "number" ? `${v}%` : "sin partidas",
      },
      xAxis: valueAxis("Winrate %", {
        max: 100,
        axisLabel: { color: MUTED, formatter: "{value}%" },
      }),
      yAxis: {
        ...categoryAxis(),
        data: groups.map((g) => g.name),
        inverse: true, // primer objetivo arriba
        axisLabel: { color: MUTED, fontSize: 11 },
      },
      series: [
        {
          name: "A favor",
          type: "bar",
          barMaxWidth: 14,
          barGap: "12%", // 2px de superficie entre barras adyacentes
          itemStyle: { color: WIN, opacity: 0.85, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            color: MUTED,
            fontSize: 10,
            formatter: (p: unknown) => {
              const { name, value } = p as { name: string; value: number | null };
              const n = counts.get(name)?.mine ?? 0;
              return value === null || !n ? "" : `${value}% · ${n}g`;
            },
          },
          data: groups.map((g) => wr(g.mine)),
        },
        {
          name: "En contra",
          type: "bar",
          barMaxWidth: 14,
          itemStyle: { color: LOSS, opacity: 0.85, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: "right",
            color: MUTED,
            fontSize: 10,
            formatter: (p: unknown) => {
              const { name, value } = p as { name: string; value: number | null };
              const n = counts.get(name)?.theirs ?? 0;
              return value === null || !n ? "" : `${value}% · ${n}g`;
            },
          },
          data: groups.map((g) => wr(g.theirs)),
        },
      ],
    };
  }, [objectives]);

  return <EChart option={option} />;
}
