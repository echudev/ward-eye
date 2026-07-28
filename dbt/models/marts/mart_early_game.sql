-- mart_early_game.sql
-- Análisis del early game usando los frames del timeline.
-- Esta tabla es clave para detectar problemas de laning phase.
--
-- Los snapshots @10 y @15 salen de int_frame_snapshots (frame más cercano al
-- hito). Antes se resolvían con `max(case when timestamp_min between 14 and 16)`,
-- que se quedaba con el frame más tardío de la ventana en vez del más cercano
-- e inflaba el snapshot ~1 minuto de recursos.

with my_games as (
    select match_id, puuid, participant_id, team_id, team_position, champion_name, win
    from {{ ref('stg_participants') }}
    where is_me = true
),

-- Snapshots del jugador en los hitos 10 y 15.
-- (el timeline usa participant_id numérico, no puuid: filtramos por el
-- participant_id real del jugador, tomado directo de la Riot API)
my_snapshots as (
    select
        s.match_id,
        s.minute_mark,
        s.actual_frame_min,
        s.total_gold,
        s.xp,
        s.level,
        s.total_cs_at_frame
    from {{ ref('int_frame_snapshots') }} s
    inner join my_games mg
        on s.match_id = mg.match_id
        and s.participant_id = mg.participant_id
    where s.minute_mark in (10, 15)
),

snapshots as (
    select
        match_id,

        max(case when minute_mark = 10 then total_gold        end) as gold_at_10,
        max(case when minute_mark = 10 then total_cs_at_frame end) as cs_at_10,
        max(case when minute_mark = 10 then xp                end) as xp_at_10,
        max(case when minute_mark = 10 then level             end) as level_at_10,
        max(case when minute_mark = 10 then actual_frame_min  end) as frame_min_at_10,

        max(case when minute_mark = 15 then total_gold        end) as gold_at_15,
        max(case when minute_mark = 15 then total_cs_at_frame end) as cs_at_15,
        max(case when minute_mark = 15 then xp                end) as xp_at_15,
        max(case when minute_mark = 15 then level             end) as level_at_15,
        max(case when minute_mark = 15 then actual_frame_min  end) as frame_min_at_15

    -- max() acá es seguro: int_frame_snapshots tiene una sola fila por
    -- (match_id, participant_id, minute_mark), así que es un pivot, no una elección
    from my_snapshots
    group by match_id
),

-- Kills y muertes del jugador en early game (antes del min 15).
-- killer_id/victim_id/participant_id se comparan contra SU participant_id:
-- de lo contrario se cuentan los kills/deaths de las 10 personas de la partida.
early_events as (
    select
        e.match_id,
        count(case when e.event_type = 'CHAMPION_KILL' and e.killer_id = mg.participant_id
                        and e.timestamp_min <= 15 then 1 end) as early_kills,
        count(case when e.event_type = 'CHAMPION_KILL' and e.victim_id = mg.participant_id
                        and e.timestamp_min <= 15 then 1 end) as early_deaths,
        -- is_real_ward descarta trampas y objetos de campeón (ver stg_timeline_events)
        count(case when e.is_real_ward and e.participant_id = mg.participant_id
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

    -- CS por minuto early.
    -- Dividimos por el minuto real del frame, no por el hito nominal: el frame
    -- que representa el "minuto 15" puede estar en 14.94 o 15.01.
    round(s.cs_at_10::numeric / nullif(s.frame_min_at_10, 0), 1)   as cs_per_min_at_10,
    round(s.cs_at_15::numeric / nullif(s.frame_min_at_15, 0), 1)   as cs_per_min_at_15,

    -- Eventos early
    coalesce(ee.early_kills,  0)            as early_kills,
    coalesce(ee.early_deaths, 0)            as early_deaths,
    coalesce(ee.early_wards,  0)            as early_wards

from my_games mg
left join snapshots   s  using (match_id)
left join early_events ee using (match_id)
