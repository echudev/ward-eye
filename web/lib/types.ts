/**
 * Tipos de las filas de los marts (`lol_marts.*`).
 * Solo incluyen las columnas que consume el dashboard.
 * Los numéricos llegan como `number` salvo los DECIMAL/NUMERIC, que el driver
 * de DuckDB devuelve como string: por eso las queries los castean con
 * `::double` (NO `::float` — en DuckDB `FLOAT` es alias de `REAL`, 32 bits,
 * y pierde precisión al volver a un `number` de JS de 64 bits).
 */

export type MatchPerformance = {
  match_id: string;
  game_date: string; // YYYY-MM-DD
  game_start_at: string; // ISO
  queue_name: string | null;
  champion_name: string;
  team_position: string | null;
  win: boolean;
  game_duration_min: number;
  kills: number;
  deaths: number;
  assists: number;
  kda_ratio: number;
  total_cs: number;
  cs_per_min: number;
  vision_score: number;
  vision_per_min: number;
  damage_per_min: number;
  damage_share: number; // 0..1
  kill_participation: number; // 0..1
  gold_per_min: number;
  gold_share: number; // 0..1
  control_wards_bought: number;
  total_damage_taken: number;
  solo_kills: number;
  dragon_kills: number; // objetivos asegurados por el jugador
  baron_kills: number;
  turret_kills: number;
  first_blood_kill: boolean;
  first_tower_kill: boolean;
};

export type ChampionStat = {
  champion_name: string;
  games_played: number;
  wins: number;
  losses: number;
  winrate_pct: number;
  main_position: string | null;
  avg_kda: number;
  avg_kills: number;
  avg_deaths: number;
  avg_assists: number;
  avg_cs_per_min: number;
  avg_vision_per_min: number;
  avg_damage_per_min: number;
  avg_gold_per_min: number;
  recent_winrate_pct: number | null;
  winrate_trend: number | null;
  kda_trend: number | null;
};

export type EarlyGame = {
  match_id: string;
  champion_name: string;
  team_position: string | null;
  win: boolean;
  game_start_at: string | null;
  cs_at_10: number | null;
  gold_at_10: number | null;
  gold_at_15: number | null;
  cs_per_min_at_10: number | null;
  cs_per_min_at_15: number | null;
  early_kills: number;
  early_deaths: number;
  early_wards: number;
};

export type PlayerTrend = {
  week_start: string; // YYYY-MM-DD
  queue_id: number;
  queue_name: string;
  games: number;
  wins: number;
  winrate_pct: number;
  avg_kda: number;
  avg_cs_per_min: number;
  avg_vision_per_min: number;
  avg_damage_per_min: number;
};

export type Summary = {
  total_games: number;
  wins: number;
  winrate_pct: number;
  avg_kda: number;
  avg_cs_per_min: number;
  avg_vision_per_min: number;
  avg_damage_per_min: number;
};

export type CoachMeta = {
  player: string | null; // "Nombre#tag"
  region: string | null;
  mainRole: string | null;
  totalGames: number | null;
  analyzedGames: number;
  dateFrom: string | null; // YYYY-MM-DD
  dateTo: string | null; // YYYY-MM-DD
  winratePct: number | null;
};

export type DashboardData = {
  summary: Summary | null;
  matches: MatchPerformance[];
  champions: ChampionStat[];
  earlyGame: EarlyGame[];
  trends: PlayerTrend[];
  error: string | null;
};
