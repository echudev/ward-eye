import "server-only";
import OpenAI from "openai";
import type { ChampionStat, MatchPerformance, Summary } from "./types";

/**
 * Coaching contra un endpoint OpenAI-compatible.
 * Configurable por env para swappear de proveedor sin tocar código:
 *   LLM_BASE_URL  (ej: https://api.groq.com/openai/v1)
 *   LLM_API_KEY   (la key del proveedor)
 *   LLM_MODEL     (ej: llama-3.3-70b-versatile)
 *
 * Para usar Claude más adelante: LLM_BASE_URL=https://api.anthropic.com/v1/
 * con su endpoint OpenAI-compatible, o reemplazar por el SDK `anthropic`.
 */

const BASE_URL = process.env.LLM_BASE_URL ?? "https://api.groq.com/openai/v1";
const MODEL = process.env.LLM_MODEL ?? "llama-3.3-70b-versatile";

export type CoachInput = {
  summary: Summary | null;
  matches: MatchPerformance[];
  champions: ChampionStat[];
};

export type CoachResult = {
  report: string;
  model: string;
};

function buildPrompt({ summary, matches, champions }: CoachInput): string {
  const recent = matches.slice(0, 12).map((m) => {
    const res = m.win ? "W" : "L";
    return [
      `${m.game_date} ${res} ${m.champion_name}(${m.team_position ?? "?"})`,
      `KDA ${m.kills}/${m.deaths}/${m.assists} (${m.kda_ratio})`,
      `CS/min ${m.cs_per_min}`,
      `Vis/min ${m.vision_per_min}`,
      `Dmg/min ${Math.round(m.damage_per_min)}`,
      `DmgShare ${(m.damage_share * 100).toFixed(0)}%`,
      `KP ${(m.kill_participation * 100).toFixed(0)}%`,
    ].join(" | ");
  });

  const champs = champions.slice(0, 8).map((c) =>
    [
      `${c.champion_name}(${c.main_position ?? "?"})`,
      `${c.games_played}g`,
      `WR ${c.winrate_pct}%`,
      `KDA ${c.avg_kda}`,
      `CS/min ${c.avg_cs_per_min}`,
      `Vis/min ${c.avg_vision_per_min}`,
    ].join(" | "),
  );

  const summaryLine = summary
    ? `Global: ${summary.total_games} partidas, WR ${summary.winrate_pct}%, KDA ${summary.avg_kda}, CS/min ${summary.avg_cs_per_min}, Vis/min ${summary.avg_vision_per_min}, Dmg/min ${Math.round(summary.avg_damage_per_min)}`
    : "Sin resumen global disponible.";

  return [
    summaryLine,
    "",
    "Partidas recientes (más nuevas primero):",
    ...recent,
    "",
    "Campeones (histórico ranked):",
    ...champs,
  ].join("\n");
}

const SYSTEM_PROMPT = `Sos un coach de League of Legends que analiza datos de partidas de un jugador.
Hablás en español rioplatense, directo y concreto, sin relleno.
Basate SOLO en las métricas provistas; no inventes datos que no estén.
Referencias rápidas para contextualizar (soloQ típico): CS/min bueno >7 (mid/top), soportes ~1-2; Vis/min: soporte >2 muy bueno, otros roles >0.8; KP alto >50%.
Devolvé el análisis en Markdown con EXACTAMENTE estas secciones:
## Resumen
## Puntos fuertes
## Áreas de mejora
## Objetivos próxima sesión
Cada sección con 2-4 bullets accionables. Sé específico citando métricas.`;

export async function generateCoaching(
  input: CoachInput,
): Promise<CoachResult> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta LLM_API_KEY en web/.env.local (key de Groq u otro proveedor OpenAI-compatible).",
    );
  }
  if (input.matches.length === 0) {
    throw new Error("No hay partidas para analizar todavía.");
  }

  const client = new OpenAI({ baseURL: BASE_URL, apiKey });

  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(input) },
    ],
  });

  const report = completion.choices[0]?.message?.content?.trim();
  if (!report) {
    throw new Error("El modelo no devolvió contenido.");
  }
  return { report, model: MODEL };
}
