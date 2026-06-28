import { getDashboardData } from "@/lib/queries";
import { Card } from "@/components/Card";
import { Kpis } from "@/components/Kpis";
import { MatchesTable } from "@/components/MatchesTable";
import { CoachingPanel } from "@/components/CoachingPanel";
import TrendsChart from "@/components/charts/TrendsChart";
import TrendsResourcesChart from "@/components/charts/TrendsResourcesChart";
import KdaTimelineChart from "@/components/charts/KdaTimelineChart";
import ImpactScatterChart from "@/components/charts/ImpactScatterChart";
import ChampionWinrateChart from "@/components/charts/ChampionWinrateChart";
import EarlyGameChart from "@/components/charts/EarlyGameChart";

// Consulta DB en cada request; nunca prerenderizar con datos viejos.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  const hasData = data.matches.length > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">ward-eye</h1>
          <p className="text-sm text-zinc-500">
            Dashboard de partidas de League of Legends + coaching automático
          </p>
        </header>

        {data.error && (
          <div className="mb-6 rounded-xl border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-300">
            <p className="font-semibold">No se pudieron cargar los datos.</p>
            <p className="mt-1 text-amber-400/80">{data.error}</p>
            <p className="mt-1 text-xs text-amber-500/70">
              Verificá que el proyecto de Supabase esté activo y las variables
              DB_* en <code>web/.env.local</code>.
            </p>
          </div>
        )}

        {!data.error && !hasData && (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            No hay partidas en los marts todavía. Corré el pipeline (dlt + dbt)
            para poblarlos.
          </div>
        )}

        <Kpis summary={data.summary} />

        <div className="mt-6">
          <Card
            title="Coaching"
            subtitle="Análisis de tus partidas recientes vía LLM (OpenAI-compatible)"
          >
            <CoachingPanel />
          </Card>
        </div>

        {hasData && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Tendencia semanal" subtitle="Winrate vs KDA (ranked)">
              <TrendsChart trends={data.trends} />
            </Card>
            <Card title="Recursos por minuto" subtitle="Evolución semanal (ranked)">
              <TrendsResourcesChart trends={data.trends} />
            </Card>
            <Card title="Últimas partidas — KDA" subtitle="Kills / Deaths / Assists y ratio">
              <KdaTimelineChart matches={data.matches} />
            </Card>
            <Card title="Impacto en partida" subtitle="Daño share % vs Kill participation %">
              <ImpactScatterChart matches={data.matches} />
            </Card>
            <Card title="Winrate por campeón" subtitle="Histórico ranked (con nº de partidas)">
              <ChampionWinrateChart champions={data.champions} />
            </Card>
            <Card title="Early game" subtitle="CS/min a min 10 y 15, muertes ≤15m">
              <EarlyGameChart earlyGame={data.earlyGame} />
            </Card>
          </div>
        )}

        {hasData && (
          <div className="mt-6">
            <Card title="Partidas recientes">
              <MatchesTable matches={data.matches} />
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
