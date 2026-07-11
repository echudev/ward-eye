import "server-only";
import { withRun, type Run } from "./db";
import type {
  ChampionStat,
  DashboardData,
  EarlyGame,
  MatchPerformance,
  PlayerTrend,
  Summary,
} from "./types";

const MARTS = "lol_marts";

/** Resumen global sobre todas las partidas (para las KPI cards). */
async function querySummary(run: Run): Promise<Summary | null> {
  const rows = await run<Summary>(`
    select
      count(*)::int                                   as total_games,
      sum(case when win then 1 else 0 end)::int       as wins,
      round(avg(case when win then 1.0 else 0.0 end) * 100, 1)::double as winrate_pct,
      round(avg(kda_ratio), 2)::double                 as avg_kda,
      round(avg(cs_per_min), 2)::double                as avg_cs_per_min,
      round(avg(vision_per_min), 2)::double            as avg_vision_per_min,
      round(avg(damage_per_min), 0)::double            as avg_damage_per_min
    from ${MARTS}.mart_match_performance
  `);
  const s = rows[0];
  return s && s.total_games > 0 ? s : null;
}

/** Últimas N partidas (mart central). */
async function queryMatchPerformance(
  run: Run,
  limit = 30,
): Promise<MatchPerformance[]> {
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
    order by game_start_at desc
    limit ?
  `,
    [limit],
  );
}

/** Stats agregadas por campeón (solo ranked, según el mart). */
async function queryChampionStats(
  run: Run,
  limit = 15,
): Promise<ChampionStat[]> {
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
    order by games_played desc
    limit ?
  `,
    [limit],
  );
}

/** Early game de las últimas N partidas, ordenado cronológicamente. */
async function queryEarlyGame(run: Run, limit = 30): Promise<EarlyGame[]> {
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
    order by m.game_start_at desc nulls last
    limit ?
  `,
    [limit],
  );
}

/** Tendencias semanales (ranked), de la más vieja a la más nueva. */
async function queryPlayerTrends(run: Run): Promise<PlayerTrend[]> {
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

/** Carga todo el dashboard en paralelo; degrada con elegancia si la DB falla. */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    return await withRun(async (run) => {
      const [summary, matches, champions, earlyGame, trends] = await Promise.all(
        [
          querySummary(run),
          queryMatchPerformance(run, 30),
          queryChampionStats(run, 15),
          queryEarlyGame(run, 30),
          queryPlayerTrends(run),
        ],
      );
      return { summary, matches, champions, earlyGame, trends, error: null };
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
      error: message,
    };
  }
}

/** Datos para el endpoint de coaching (límites más chicos que el dashboard). */
export async function getCoachingData(): Promise<{
  summary: Summary | null;
  matches: MatchPerformance[];
  champions: ChampionStat[];
  earlyGame: EarlyGame[];
  trends: PlayerTrend[];
}> {
  return withRun(async (run) => {
    const [summary, matches, champions, earlyGame, trends] = await Promise.all([
      querySummary(run),
      queryMatchPerformance(run, 20),
      queryChampionStats(run, 10),
      queryEarlyGame(run, 20),
      queryPlayerTrends(run),
    ]);
    return { summary, matches, champions, earlyGame, trends };
  });
}
