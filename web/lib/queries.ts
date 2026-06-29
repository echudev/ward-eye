import "server-only";
import { getSql } from "./db";
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
export async function getSummary(): Promise<Summary | null> {
  const sql = getSql();
  const rows = await sql<Summary[]>`
    select
      count(*)::int                                   as total_games,
      sum(case when win then 1 else 0 end)::int       as wins,
      round(avg(case when win then 1.0 else 0.0 end) * 100, 1)::float as winrate_pct,
      round(avg(kda_ratio), 2)::float                 as avg_kda,
      round(avg(cs_per_min), 2)::float                as avg_cs_per_min,
      round(avg(vision_per_min), 2)::float            as avg_vision_per_min,
      round(avg(damage_per_min), 0)::float            as avg_damage_per_min
    from ${sql(MARTS)}.mart_match_performance
  `;
  const s = rows[0];
  return s && s.total_games > 0 ? s : null;
}

/** Últimas N partidas (mart central). */
export async function getMatchPerformance(
  limit = 30,
): Promise<MatchPerformance[]> {
  const sql = getSql();
  return sql<MatchPerformance[]>`
    select
      match_id,
      game_date::text                       as game_date,
      game_start_at::text                   as game_start_at,
      queue_name,
      champion_name,
      team_position,
      win,
      game_duration_min::float              as game_duration_min,
      kills::int, deaths::int, assists::int,
      kda_ratio::float                      as kda_ratio,
      total_cs::int                         as total_cs,
      cs_per_min::float                     as cs_per_min,
      vision_score::int                     as vision_score,
      vision_per_min::float                 as vision_per_min,
      damage_per_min::float                 as damage_per_min,
      damage_share::float                   as damage_share,
      kill_participation::float             as kill_participation,
      gold_per_min::float                   as gold_per_min,
      gold_share::float                     as gold_share,
      control_wards_bought::int             as control_wards_bought,
      total_damage_taken::int               as total_damage_taken,
      solo_kills::int                       as solo_kills,
      dragon_kills::int                     as dragon_kills,
      baron_kills::int                      as baron_kills,
      turret_kills::int                     as turret_kills,
      first_blood_kill,
      first_tower_kill
    from ${sql(MARTS)}.mart_match_performance
    order by game_start_at desc
    limit ${limit}
  `;
}

/** Stats agregadas por campeón (solo ranked, según el mart). */
export async function getChampionStats(limit = 15): Promise<ChampionStat[]> {
  const sql = getSql();
  return sql<ChampionStat[]>`
    select
      champion_name,
      games_played::int,
      wins::int,
      losses::int,
      winrate_pct::float,
      main_position,
      avg_kda::float,
      avg_kills::float,
      avg_deaths::float,
      avg_assists::float,
      avg_cs_per_min::float,
      avg_vision_per_min::float,
      avg_damage_per_min::float,
      avg_gold_per_min::float,
      recent_winrate_pct::float,
      winrate_trend::float,
      kda_trend::float
    from ${sql(MARTS)}.mart_champion_stats
    order by games_played desc
    limit ${limit}
  `;
}

/** Early game de las últimas N partidas, ordenado cronológicamente. */
export async function getEarlyGame(limit = 30): Promise<EarlyGame[]> {
  const sql = getSql();
  return sql<EarlyGame[]>`
    select
      e.match_id,
      e.champion_name,
      e.team_position,
      e.win,
      m.game_start_at::text                 as game_start_at,
      e.cs_at_10::float                     as cs_at_10,
      e.gold_at_10::float                   as gold_at_10,
      e.gold_at_15::float                   as gold_at_15,
      e.cs_per_min_at_10::float             as cs_per_min_at_10,
      e.cs_per_min_at_15::float             as cs_per_min_at_15,
      e.early_kills::int                    as early_kills,
      e.early_deaths::int                   as early_deaths,
      e.early_wards::int                    as early_wards
    from ${sql(MARTS)}.mart_early_game e
    left join ${sql(MARTS)}.mart_match_performance m using (match_id)
    order by m.game_start_at desc nulls last
    limit ${limit}
  `;
}

/** Tendencias semanales (ranked), de la más vieja a la más nueva. */
export async function getPlayerTrends(): Promise<PlayerTrend[]> {
  const sql = getSql();
  return sql<PlayerTrend[]>`
    select
      week_start::text                      as week_start,
      queue_id::int,
      queue_name,
      games::int,
      wins::int,
      winrate_pct::float,
      avg_kda::float,
      avg_cs_per_min::float,
      avg_vision_per_min::float,
      avg_damage_per_min::float
    from ${sql(MARTS)}.mart_player_trends
    order by week_start asc, queue_id
  `;
}

/** Carga todo el dashboard en paralelo; degrada con elegancia si la DB falla. */
export async function getDashboardData(): Promise<DashboardData> {
  try {
    const [summary, matches, champions, earlyGame, trends] = await Promise.all([
      getSummary(),
      getMatchPerformance(30),
      getChampionStats(15),
      getEarlyGame(30),
      getPlayerTrends(),
    ]);
    return { summary, matches, champions, earlyGame, trends, error: null };
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
