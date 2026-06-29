import { NextResponse } from "next/server";
import { generateCoaching } from "@/lib/coach";
import {
  getChampionStats,
  getEarlyGame,
  getMatchPerformance,
  getPlayerTrends,
  getSummary,
} from "@/lib/queries";

// Siempre en runtime: consulta DB + LLM, nunca prerenderizar.
export const dynamic = "force-dynamic";

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
    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error generando el coaching.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
