"use client";

import { useState, type ReactNode } from "react";

type CoachResponse = { report?: string; model?: string; error?: string };

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-zinc-100">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

/** Render mínimo de Markdown (headings, bullets, bold) sin dependencias. */
function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (bullets.length) {
      out.push(
        <ul key={key} className="mb-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  text.split("\n").forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      flush(`f${i}`);
      out.push(
        <h3 key={i} className="mt-4 mb-1 text-sm font-semibold text-emerald-400">
          {line.replace(/^#{1,3}\s/, "")}
        </h3>,
      );
    } else if (/^\s*[-*]\s/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s/, ""));
    } else if (line === "") {
      flush(`f${i}`);
    } else {
      flush(`f${i}`);
      out.push(
        <p key={i} className="mb-2 text-sm text-zinc-300">
          {inline(line)}
        </p>,
      );
    }
  });
  flush("end");
  return <>{out}</>;
}

export function CoachingPanel() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coaching", { method: "POST" });
      const data: CoachResponse = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Error generando el coaching.");
      }
      setReport(data.report ?? "");
      setModel(data.model ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Analizando…" : "Generar coaching"}
        </button>
        {model && <span className="text-xs text-zinc-500">modelo: {model}</span>}
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {report && (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
          <Markdown text={report} />
        </div>
      )}

      {!report && !error && !loading && (
        <p className="mt-3 text-sm text-zinc-500">
          Genera un análisis de tus partidas recientes con el LLM configurado.
        </p>
      )}
    </div>
  );
}
