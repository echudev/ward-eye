import { NextResponse } from "next/server";
import { generateCoaching } from "@/lib/coach";
import {
  getChampionStats,
  getEarlyGame,
  getMatchPerformance,
  getPlayerTrends,
  getSummary,
} from "@/lib/queries";
import type { CoachMeta, MatchPerformance, Summary } from "@/lib/types";

// Siempre en runtime: consulta DB + LLM, nunca prerenderizar.
export const dynamic = "force-dynamic";

/** Metadata de contexto para el encabezado del informe / PDF. */
function buildMeta(summary: Summary | null, matches: MatchPerformance[]): CoachMeta {
  const name = process.env.SUMMONER_NAME?.trim();
  const tag = process.env.SUMMONER_TAG?.trim();
  const player = name ? (tag ? `${name}#${tag}` : name) : null;
  const region = process.env.RIOT_REGION?.trim().toUpperCase() || null;

  // rol principal = posición más frecuente
  const counts = new Map<string, number>();
  for (const m of matches) {
    const r = m.team_position || "UNKNOWN";
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  let mainRole: string | null = null;
  let bestN = -1;
  for (const [r, n] of counts) {
    if (n > bestN) {
      mainRole = r;
      bestN = n;
    }
  }

  const dates = matches.map((m) => m.game_date).sort();

  return {
    player,
    region,
    mainRole,
    totalGames: summary?.total_games ?? null,
    analyzedGames: matches.length,
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
    winratePct: summary?.winrate_pct ?? null,
  };
}

export async function POST() {
  try {
    const [summary, matches, champions, earlyGame, trends] = await Promise.all([
      getSummary(),
      getMatchPerformance(20),
      getChampionStats(10),
      getEarlyGame(20),
      getPlayerTrends(),
    ]);

    const result = await generateCoaching({
      summary,
      matches,
      champions,
      earlyGame,
      trends,
    });
    const meta = buildMeta(summary, matches);
    return NextResponse.json({ ...result, meta });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error generando el coaching.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
