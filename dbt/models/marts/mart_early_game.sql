-- mart_early_game.sql
-- Análisis del early game usando los frames del timeline.
-- Compara al jugador vs sus oponentes de línea en los primeros 15 minutos.
-- Esta tabla es clave para detectar problemas de laning phase.

with my_games as (
    select match_id, puuid, team_id, team_position, champion_name, win
    from {{ ref('stg_participants') }}
    where is_me = true
),

-- Participante ID del jugador en cada partida
-- (el timeline usa participant_id numérico, no puuid)
my_participant_ids as (
    select
        p.match_id,
        p.puuid,
        -- dlt asigna el participant_id según el orden en la lista de participantes
        -- lo reconstruimos buscando el registro en raw_participants
        row_number() over (
            partition by p.match_id
            order by p.puuid
        ) as participant_id   -- aproximación; ajustar si hay discrepancias
    from {{ ref('stg_participants') }} p
    inner join my_games mg using (match_id)
),

-- Frames del jugador en early game
my_frames as (
    select
        f.match_id,
        f.timestamp_min,
        f.total_gold,
        f.xp,
        f.total_cs_at_frame,
        f.level,
        f.game_phase
    from {{ ref('stg_timeline_frames') }} f
    inner join my_games mg using (match_id)
    -- Filtramos aproximando al participant_id del jugador
    -- (refinable una vez que tengamos datos reales y podamos validar)
    where f.timestamp_min <= 20
),

-- Snapshot en minuto 10 y 15 para cada partida del jugador
snapshots as (
    select
        match_id,

        max(case when timestamp_min between 9  and 11 then total_gold         end) as gold_at_10,
        max(case when timestamp_min between 9  and 11 then total_cs_at_frame  end) as cs_at_10,
        max(case when timestamp_min between 9  and 11 then xp                 end) as xp_at_10,
        max(case when timestamp_min between 9  and 11 then level              end) as level_at_10,

        max(case when timestamp_min between 14 and 16 then total_gold         end) as gold_at_15,
        max(case when timestamp_min between 14 and 16 then total_cs_at_frame  end) as cs_at_15,
        max(case when timestamp_min between 14 and 16 then xp                 end) as xp_at_15,
        max(case when timestamp_min between 14 and 16 then level              end) as level_at_15

    from my_frames
    group by match_id
),

-- Kills y muertes en early game (antes del min 15)
early_events as (
    select
        e.match_id,
        count(case when e.event_type = 'CHAMPION_KILL' and e.killer_id is not null
                        and e.timestamp_min <= 15 then 1 end) as early_kills,
        count(case when e.event_type = 'CHAMPION_KILL' and e.victim_id is not null
                        and e.timestamp_min <= 15 then 1 end) as early_deaths,
        count(case when e.event_type = 'WARD_PLACED'
                        and e.timestamp_min <= 15 then 1 end) as early_wards
    from {{ ref('stg_timeline_events') }} e
    inner join my_games mg using (match_id)
    group by e.match_id
)

select
    mg.match_id,
    mg.champion_name,
    mg.team_position,
    mg.win,

    -- Snapshots de recursos
    s.cs_at_10,
    s.gold_at_10,
    s.xp_at_10,
    s.level_at_10,
    s.cs_at_15,
    s.gold_at_15,
    s.xp_at_15,
    s.level_at_15,

    -- CS por minuto early
    round(s.cs_at_10::numeric / 10, 1)     as cs_per_min_at_10,
    round(s.cs_at_15::numeric / 15, 1)     as cs_per_min_at_15,

    -- Eventos early
    coalesce(ee.early_kills,  0)            as early_kills,
    coalesce(ee.early_deaths, 0)            as early_deaths,
    coalesce(ee.early_wards,  0)            as early_wards

from my_games mg
left join snapshots   s  using (match_id)
left join early_events ee using (match_id)
