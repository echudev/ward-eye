/**
 * Tokens de estilo compartidos para los gráficos ECharts sobre fondo oscuro.
 */
import type { EChartsOption } from "echarts";

export const TEXT = "#e4e4e7"; // zinc-200
export const MUTED = "#a1a1aa"; // zinc-400
export const SPLIT = "#27272a"; // zinc-800
export const AXIS_LINE = "#3f3f46"; // zinc-700

export const WIN = "#34d399"; // emerald-400
export const LOSS = "#f87171"; // red-400

export const PALETTE = [
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#f59e0b", // amber-500
  "#f472b6", // pink-400
  "#a78bfa", // violet-400
  "#22d3ee", // cyan-400
];

/** Base común: fondo transparente, tooltip y grilla coherentes. */
export const baseOption: EChartsOption = {
  backgroundColor: "transparent",
  textStyle: { color: MUTED, fontFamily: "inherit" },
  grid: { left: 48, right: 48, top: 48, bottom: 40, containLabel: true },
  tooltip: {
    backgroundColor: "#18181b",
    borderColor: SPLIT,
    textStyle: { color: TEXT },
  },
  legend: { textStyle: { color: MUTED }, top: 8 },
};

export function tooltip(trigger: "axis" | "item" = "item") {
  return {
    trigger,
    backgroundColor: "#18181b",
    borderColor: SPLIT,
    textStyle: { color: TEXT },
  };
}

export function categoryAxis(name?: string) {
  return {
    type: "category" as const,
    name,
    nameTextStyle: { color: MUTED },
    axisLine: { lineStyle: { color: AXIS_LINE } },
    axisLabel: { color: MUTED },
    splitLine: { show: false },
  };
}

export function valueAxis(name?: string, extra: Record<string, unknown> = {}) {
  return {
    type: "value" as const,
    name,
    nameTextStyle: { color: MUTED },
    axisLine: { show: false },
    axisLabel: { color: MUTED },
    splitLine: { lineStyle: { color: SPLIT } },
    ...extra,
  };
}
