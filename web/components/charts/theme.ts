/**
 * Tokens de estilo para los gráficos ECharts: fondo oscuro + acentos fluor.
 */
import type { EChartsOption } from "echarts";

export const TEXT = "#e8e8ea";
export const MUTED = "#9b9ba3";
export const SPLIT = "rgba(255, 255, 255, 0.06)";
export const AXIS_LINE = "#3a3a40";

export const WIN = "#4cd7b3"; // turquesa (positivo)
export const LOSS = "#ff4d6a"; // rojo (negativo)
export const SECONDARY = "#b87ab3"; // malva (secundario)

export const PALETTE = [
  "#4cd7b3", // turquesa (principal)
  "#b87ab3", // malva (secundario)
  "#6cc5e0", // celeste
  "#e0a3d6", // malva claro
  "#80e0c4", // turquesa claro
  "#d8b46a", // ocre
];

/** Base común: fondo transparente, tooltip y grilla coherentes. */
export const baseOption: EChartsOption = {
  backgroundColor: "transparent",
  textStyle: { color: MUTED, fontFamily: "inherit" },
  grid: { left: 48, right: 48, top: 48, bottom: 40, containLabel: true },
  tooltip: {
    backgroundColor: "#141416",
    borderColor: AXIS_LINE,
    textStyle: { color: TEXT },
  },
  legend: { textStyle: { color: MUTED }, top: 8 },
};

/** Recorta a 2 decimales cualquier valor numérico mostrado en el tooltip. */
function roundTooltipValue(value: unknown): string {
  if (typeof value === "number") return Number(value.toFixed(2)).toString();
  if (Array.isArray(value)) return value.map(roundTooltipValue).join(", ");
  return String(value);
}

export function tooltip(trigger: "axis" | "item" = "item") {
  return {
    trigger,
    backgroundColor: "#141416",
    borderColor: AXIS_LINE,
    textStyle: { color: TEXT },
    valueFormatter: roundTooltipValue,
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
