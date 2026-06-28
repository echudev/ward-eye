"use client";

import { useEffect, useRef } from "react";
import type { EChartsOption } from "echarts";

type EChartsInstance = import("echarts").ECharts;

/**
 * Wrapper liviano sobre Apache ECharts.
 * `echarts` se importa dinámicamente dentro de useEffect, así nunca toca
 * `window` durante el SSR y queda fuera del bundle del servidor.
 */
export default function EChart({
  option,
  className,
  height = 320,
}: {
  option: EChartsOption;
  className?: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);

  // init + dispose (una sola vez)
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;

    void import("echarts").then((echarts) => {
      const el = containerRef.current;
      if (disposed || !el) return;
      const chart = echarts.init(el, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      chart.setOption(option);
      observer = new ResizeObserver(() => chart.resize());
      observer.observe(el);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      chartRef.current?.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-render cuando cambia la opción
  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option]);

  return (
    <div ref={containerRef} className={className} style={{ width: "100%", height }} />
  );
}
