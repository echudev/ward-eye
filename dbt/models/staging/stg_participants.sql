-- stg_participants.sql
-- Limpia participantes y calcula métricas derivadas por partida.
-- Todas las métricas "por minuto" se calculan acá una sola vez.

with source as (
    select * from {{ source('lol_raw', 'raw_participants') }}
),

-- Referencia stg_matches (no la fuente raw) para heredar el filtro de remakes:
-- las partidas <5min quedan afuera acá y de paso de todo lo que depende de esta CTE.
matches as (
    select match_id, game_duration_s
    from {{ ref('stg_matches') }}
),

cleaned as (
    select
        p.match_id,
        p.puuid,
        p.participant_id,
        p.is_me,
        p.summoner_name,
        p.riot_id_name,
        p.riot_id_tag,
        p.champion_id,
        p.champion_name,
        p.team_id,
        p.team_position,
        p.individual_position,
        p.win,
        p.champ_level,

        -- KDA
        p.kills,
        p.deaths,
        p.assists,
        -- KDA ratio (deaths=0 → perfecto, usamos 1 como denominador mínimo)
        round(
            (p.kills + p.assists)::numeric / nullif(p.deaths, 0),
        2)                                              as kda_ratio,

        -- Farm
        p.total_minions_killed,
        p.neutral_minions_killed,
        (p.total_minions_killed + p.neutral_minions_killed) as total_cs,
        round(
            (p.total_minions_killed + p.neutral_minions_killed)::numeric
            / nullif(m.game_duration_s / 60.0, 0),
        2)                                              as cs_per_min,

        -- Visión
        p.vision_score,
        p.wards_placed,
        p.wards_killed,
        p.control_wards_bought,
        p.vision_wards_bought,
        round(
            p.vision_score::numeric
            / nullif(m.game_duration_s / 60.0, 0),
        2)                                              as vision_per_min,

        -- Daño
        p.total_damage_dealt_to_champions,
        p.total_damage_taken,
        p.total_heal,
        p.total_heals_on_teammates,
        round(
            p.total_damage_dealt_to_champions::numeric
            / nullif(m.game_duration_s / 60.0, 0),
        2)                                              as damage_per_min,

        -- Oro
        p.gold_earned,
        p.gold_spent,
        round(
            p.gold_earned::numeric
            / nullif(m.game_duration_s / 60.0, 0),
        2)                                              as gold_per_min,

        -- Objetivos
        p.turret_kills,
        p.inhibitor_kills,
        p.dragon_kills,
        p.baron_kills,
        p.first_blood_kill,
        p.first_tower_kill,

        -- Multi-kills y rachas
        p.multikills,
        p.killing_sprees,
        p.solo_kills,
        p.time_ccing_others_s,

        -- Challenges (precalculados por Riot)
        p.kill_participation,
        p.kda                                           as kda_challenge,
        p.damage_per_minute                             as damage_per_min_challenge,
        p.gold_per_minute                               as gold_per_min_challenge,
        p.cs_per_minute                                 as cs_first_10min,

        -- Items y runas (JSON, se expanden en marts si se necesita)
        p.items_json,
        p.summoner1_id,
        p.summoner2_id,
        p.primary_rune_id,

        -- Duración de la partida (para contexto)
        m.game_duration_s,
        round(m.game_duration_s / 60.0, 1)             as game_duration_min

    from source p
    inner join matches m using (match_id)
)

select * from cleaned
