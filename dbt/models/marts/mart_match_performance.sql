-- mart_match_performance.sql
-- Una fila por partida del jugador principal (is_me = true).
-- Es la tabla central para el coaching: contiene todas las métricas
-- de una partida junto con el contexto del equipo (para calcular shares).

with my_games as (
    select *
    from {{ ref('stg_participants') }}
    where is_me = true
),

matches as (
    select *
    from {{ ref('stg_matches') }}
),

-- Totales del equipo para calcular damage share y gold share
team_totals as (
    select
        match_id,
        team_id,
        sum(total_damage_dealt_to_champions) as team_damage,
        sum(gold_earned)                     as team_gold,
        sum(kills)                           as team_kills
    from {{ ref('stg_participants') }}
    group by 1, 2
),

-- Totales del equipo contrario (para contexto de ventajas)
enemy_totals as (
    select
        p.match_id,
        sum(p.total_damage_dealt_to_champions) as enemy_damage,
        sum(p.gold_earned)                     as enemy_gold
    from {{ ref('stg_participants') }} p
    inner join my_games mg
        on p.match_id = mg.match_id
        and p.team_id != mg.team_id
    group by 1
)

select
    -- Identidad
    mg.match_id,
    mg.puuid,
    m.game_date,
    m.game_start_at,
    m.queue_name,
    m.queue_id,
    m.game_duration_min,
    m.game_version,

    -- Resultado
    mg.win,
    mg.champion_name,
    mg.team_position,
    mg.champ_level,

    -- KDA
    mg.kills,
    mg.deaths,
    mg.assists,
    mg.kda_ratio,
    mg.solo_kills,
    mg.multikills,
    mg.killing_sprees,
    mg.first_blood_kill,

    -- Farm
    mg.total_cs,
    mg.cs_per_min,
    mg.lane_minions_first_10min, -- conteo de súbditos de línea, NO un ratio

    -- Visión
    mg.vision_score,
    mg.vision_per_min,
    mg.wards_placed,
    mg.wards_killed,
    mg.control_wards_bought,

    -- Daño
    mg.total_damage_dealt_to_champions,
    mg.damage_per_min,
    mg.total_damage_taken,

    -- Shares relativos al equipo
    round(
        mg.total_damage_dealt_to_champions::numeric / nullif(tt.team_damage, 0),
    2)                                           as damage_share,
    round(
        mg.gold_earned::numeric / nullif(tt.team_gold, 0),
    2)                                           as gold_share,
    round(
        (mg.kills + mg.assists)::numeric / nullif(tt.team_kills, 0),
    2)                                           as kill_participation,

    -- Oro
    mg.gold_earned,
    mg.gold_per_min,

    -- Ventaja de oro vs equipo contrario (normalizada por duración)
    round(
        (tt.team_gold - et.enemy_gold)::numeric / nullif(m.game_duration_min, 0),
    1)                                           as team_gold_adv_per_min,

    -- Objetivos
    mg.turret_kills,
    mg.inhibitor_kills,
    mg.dragon_kills,
    mg.baron_kills,
    mg.first_tower_kill,
    mg.time_ccing_others_s,

    -- Items y runas (para análisis de builds)
    mg.items_json,
    mg.summoner1_id,
    mg.summoner2_id,
    mg.primary_rune_id,

    -- Kills del equipo y enemigo (para contexto del coaching)
    tt.team_kills,
    et.enemy_damage

from my_games mg
inner join matches m         using (match_id)
inner join team_totals tt
    on mg.match_id = tt.match_id
    and mg.team_id = tt.team_id
inner join enemy_totals et   on mg.match_id = et.match_id
