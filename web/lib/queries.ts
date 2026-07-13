import "server-only";
import { withRun, type Run } from "./db";
import type {
  ChampionOption,
  ChampionStat,
  DashboardData,
  EarlyGame,
  MatchPerformance,
  PlayerTrend,
  Summary,
} from "./types";

const MARTS = "lol_marts";

/** Normaliza el filtro de campeón: "" / "all" / undefined cuentan como "sin filtro". */
function normalizeChampion(champion?: string | null): string | null {
  const c = champion?.trim();
  return c && c.toLowerCase() !== "all" ? c : null;
}

/** Resumen global (para las KPI cards), opcionalmente acotado a un campeón. */
async function querySummary(
  run: Run,
  champion?: string | null,
): Promise<Summary | null> {
  const where = champion ? "where champion_name = ?" : "";
  const params = champion ? [champion] : [];
  const rows = await run<Summary>(
    `
    select
      count(*)::int                                   as total_games,
      sum(case when win then 1 else 0 end)::int       as wins,
      round(avg(case when win then 1.0 else 0.0 end) * 100, 1)::double as winrate_pct,
      round(avg(kda_ratio), 2)::double                 as avg_kda,
      round(avg(cs_per_min), 2)::double                as avg_cs_per_min,
      round(avg(vision_per_min), 2)::double            as avg_vision_per_min,
      round(avg(damage_per_min), 0)::double            as avg_damage_per_min
    from ${MARTS}.mart_match_performance
    ${where}
  `,
    params,
  );
  const s = rows[0];
  return s && s.total_games > 0 ? s : null;
}

/** Últimas N partidas (mart central), opcionalmente acotadas a un campeón. */
async function queryMatchPerformance(
  run: Run,
  limit = 30,
  champion?: string | null,
): Promise<MatchPerformance[]> {
  const where = champion ? "where champion_name = ?" : "";
  const params = champion ? [champion, limit] : [limit];
  return run<MatchPerformance>(
    `
    select
      match_id,
      game_date::text                       as game_date,
      game_start_at::text                   as game_start_at,
      queue_name,
      champion_name,
      team_position,
      win,
      game_duration_min::double              as game_duration_min,
      kills::int as kills, deaths::int as deaths, assists::int as assists,
      kda_ratio::double                      as kda_ratio,
      total_cs::int                         as total_cs,
      cs_per_min::double                     as cs_per_min,
      vision_score::int                     as vision_score,
      vision_per_min::double                 as vision_per_min,
      damage_per_min::double                 as damage_per_min,
      damage_share::double                   as damage_share,
      kill_participation::double             as kill_participation,
      gold_per_min::double                   as gold_per_min,
      gold_share::double                     as gold_share,
      control_wards_bought::int             as control_wards_bought,
      total_damage_taken::int               as total_damage_taken,
      solo_kills::int                       as solo_kills,
      dragon_kills::int                     as dragon_kills,
      baron_kills::int                      as baron_kills,
      turret_kills::int                     as turret_kills,
      first_blood_kill,
      first_tower_kill
    from ${MARTS}.mart_match_performance
    ${where}
    order by game_start_at desc
    limit ?
  `,
    params,
  );
}

/** Stats agregadas por campeón (solo ranked, según el mart); opcionalmente 1 sola fila. */
async function queryChampionStats(
  run: Run,
  limit = 15,
  champion?: string | null,
): Promise<ChampionStat[]> {
  const where = champion ? "where champion_name = ?" : "";
  const params = champion ? [champion, limit] : [limit];
  return run<ChampionStat>(
    `
    select
      champion_name,
      games_played::int                     as games_played,
      wins::int                             as wins,
      losses::int                           as losses,
      winrate_pct::double                    as winrate_pct,
      main_position,
      avg_kda::double                        as avg_kda,
      avg_kills::double                      as avg_kills,
      avg_deaths::double                     as avg_deaths,
      avg_assists::double                    as avg_assists,
      avg_cs_per_min::double                 as avg_cs_per_min,
      avg_vision_per_min::double             as avg_vision_per_min,
      avg_damage_per_min::double             as avg_damage_per_min,
      avg_gold_per_min::double               as avg_gold_per_min,
      recent_winrate_pct::double             as recent_winrate_pct,
      winrate_trend::double                  as winrate_trend,
      kda_trend::double                      as kda_trend
    from ${MARTS}.mart_champion_stats
    ${where}
    order by games_played desc
    limit ?
  `,
    params,
  );
}

/** Early game de las últimas N partidas, ordenado cronológicamente. */
async function queryEarlyGame(
  run: Run,
  limit = 30,
  champion?: string | null,
): Promise<EarlyGame[]> {
  const where = champion ? "where e.champion_name = ?" : "";
  const params = champion ? [champion, limit] : [limit];
  return run<EarlyGame>(
    `
    select
      e.match_id,
      e.champion_name,
      e.team_position,
      e.win,
      m.game_start_at::text                 as game_start_at,
      e.cs_at_10::double                     as cs_at_10,
      e.gold_at_10::double                   as gold_at_10,
      e.gold_at_15::double                   as gold_at_15,
      e.cs_per_min_at_10::double             as cs_per_min_at_10,
      e.cs_per_min_at_15::double             as cs_per_min_at_15,
      e.early_kills::int                    as early_kills,
      e.early_deaths::int                   as early_deaths,
      e.early_wards::int                    as early_wards
    from ${MARTS}.mart_early_game e
    left join ${MARTS}.mart_match_performance m using (match_id)
    ${where}
    order by m.game_start_at desc nulls last
    limit ?
  `,
    params,
  );
}

/**
 * Tendencias semanales (ranked), de la más vieja a la más nueva.
 * Sin filtro usa el mart precalculado (`mart_player_trends`, agregado sobre
 * todos los campeones). Con un campeón puntual, ese agregado no sirve —
 * se recalcula al vuelo desde `mart_match_performance` con el mismo criterio
 * (solo ranked, agrupado por semana) para que el gráfico de tendencia siga
 * siendo comparable.
 */
async function queryPlayerTrends(
  run: Run,
  champion?: string | null,
): Promise<PlayerTrend[]> {
  if (!champion) {
    return run<PlayerTrend>(`
      select
        week_start::text                      as week_start,
        queue_id::int                         as queue_id,
        queue_name,
        games::int                            as games,
        wins::int                             as wins,
        winrate_pct::double                    as winrate_pct,
        avg_kda::double                        as avg_kda,
        avg_cs_per_min::double                 as avg_cs_per_min,
        avg_vision_per_min::double             as avg_vision_per_min,
        avg_damage_per_min::double             as avg_damage_per_min
      from ${MARTS}.mart_player_trends
      order by week_start asc, queue_id
    `);
  }
  return run<PlayerTrend>(
    `
    with weekly as (
      select
        date_trunc('week', game_start_at)::date::text          as week_start,
        queue_id::int                                          as queue_id,
        count(*)::int                                          as games,
        sum(case when win then 1 else 0 end)::int              as wins,
        round(avg(case when win then 1.0 else 0.0 end) * 100, 1)::double as winrate_pct,
        round(avg(kda_ratio), 2)::double                        as avg_kda,
        round(avg(cs_per_min), 2)::double                       as avg_cs_per_min,
        round(avg(vision_per_min), 2)::double                   as avg_vision_per_min,
        round(avg(damage_per_min), 0)::double                   as avg_damage_per_min
      from ${MARTS}.mart_match_performance
      where queue_id in (420, 440) and champion_name = ?
      group by 1, 2
    )
    select
      week_start,
      queue_id,
      case queue_id when 420 then 'Ranked Solo' else 'Ranked Flex' end as queue_name,
      games, wins, winrate_pct, avg_kda, avg_cs_per_min, avg_vision_per_min, avg_damage_per_min
    from weekly
    order by week_start asc, queue_id
  `,
    [champion],
  );
}

/** Lista de todos los campeones jugados (todas las colas), para el picker. */
async function queryChampionList(run: Run): Promise<ChampionOption[]> {
  return run<ChampionOption>(`
    select
      champion_name,
      count(*)::int as games_played
    from ${MARTS}.mart_match_performance
    group by champion_name
    order by games_played desc, champion_name asc
  `);
}

/**
 * Carga todo el dashboard en paralelo; degrada con elegancia si la DB falla.
 * `champion` (opcional) acota todas las métricas a un solo campeón; "" / "all"
 * / undefined equivalen a "todos" (ver `normalizeChampion`).
 */
export async function getDashboardData(
  championFilter?: string | null,
): Promise<DashboardData> {
  const champion = normalizeChampion(championFilter);
  try {
    return await withRun(async (run) => {
      const [summary, matches, champions, earlyGame, trends, championList] =
        await Promise.all([
          querySummary(run, champion),
          queryMatchPerformance(run, 30, champion),
          queryChampionStats(run, 15, champion),
          queryEarlyGame(run, 30, champion),
          queryPlayerTrends(run, champion),
          queryChampionList(run),
        ]);
      return {
        summary,
        matches,
        champions,
        earlyGame,
        trends,
        championList,
        error: null,
      };
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error desconocido consultando la DB";
    return {
      summary: null,
      matches: [],
      champions: [],
      earlyGame: [],
      trends: [],
      championList: [],
      error: message,
    };
  }
}

/** Datos para el endpoint de coaching (límites más chicos que el dashboard). */
export async function getCoachingData(championFilter?: string | null): Promise<{
  summary: Summary | null;
  matches: MatchPerformance[];
  champions: ChampionStat[];
  earlyGame: EarlyGame[];
  trends: PlayerTrend[];
}> {
  const champion = normalizeChampion(championFilter);
  return withRun(async (run) => {
    const [summary, matches, champions, earlyGame, trends] = await Promise.all([
      querySummary(run, champion),
      queryMatchPerformance(run, 20, champion),
      queryChampionStats(run, 10, champion),
      queryEarlyGame(run, 20, champion),
      queryPlayerTrends(run, champion),
    ]);
    return { summary, matches, champions, earlyGame, trends };
  });
}
