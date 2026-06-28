-- mart_champion_stats.sql
-- Estadísticas históricas agregadas por campeón.
-- Una fila por campeón jugado, con promedios, winrate y tendencias.

with base as (
    select * from {{ ref('mart_match_performance') }}
    -- Solo ranked para que las estadísticas sean comparables
    where queue_id in (420, 440)
),

per_champion as (
    select
        champion_name,

        -- Volumen
        count(*)                                            as games_played,
        sum(case when win then 1 else 0 end)                as wins,
        sum(case when not win then 1 else 0 end)            as losses,
        round(
            avg(case when win then 1.0 else 0.0 end) * 100,
        1)                                                  as winrate_pct,

        -- Posición más jugada
        mode() within group (order by team_position)        as main_position,

        -- KDA
        round(avg(kda_ratio), 2)                            as avg_kda,
        round(avg(kills), 1)                                as avg_kills,
        round(avg(deaths), 1)                               as avg_deaths,
        round(avg(assists), 1)                              as avg_assists,
        sum(multikills)                                     as total_multikills,

        -- Farm
        round(avg(cs_per_min), 2)                           as avg_cs_per_min,
        round(max(cs_per_min), 2)                           as best_cs_per_min,

        -- Visión
        round(avg(vision_per_min), 2)                       as avg_vision_per_min,
        round(avg(control_wards_bought), 1)                 as avg_control_wards,

        -- Daño
        round(avg(damage_per_min), 0)                       as avg_damage_per_min,
        round(avg(damage_share), 3)                         as avg_damage_share,

        -- Oro
        round(avg(gold_per_min), 0)                         as avg_gold_per_min,
        round(avg(kill_participation), 3)                   as avg_kill_participation,

        -- Duración promedio (para saber si el champ gana early o late)
        round(avg(game_duration_min), 1)                    as avg_game_duration_min,
        round(
            avg(case when win then game_duration_min end),
        1)                                                  as avg_win_duration_min,

        -- Fechas para tendencia reciente
        min(game_date)                                      as first_game_date,
        max(game_date)                                      as last_game_date

    from base
    group by champion_name
),

-- Últimas 10 partidas por campeón para calcular forma reciente
recent_form as (
    select
        champion_name,
        round(
            avg(case when win then 1.0 else 0.0 end) * 100,
        1)                                                  as recent_winrate_pct,
        round(avg(kda_ratio), 2)                            as recent_avg_kda
    from (
        select
            *,
            row_number() over (
                partition by champion_name
                order by game_start_at desc
            ) as rn
        from base
    ) ranked
    where rn <= 10
    group by champion_name
)

select
    pc.*,
    rf.recent_winrate_pct,
    rf.recent_avg_kda,

    -- Diferencia forma reciente vs histórico (positivo = mejorando)
    round(rf.recent_winrate_pct - pc.winrate_pct, 1)       as winrate_trend,
    round(rf.recent_avg_kda    - pc.avg_kda,      2)       as kda_trend

from per_champion pc
left join recent_form rf using (champion_name)
order by games_played desc
