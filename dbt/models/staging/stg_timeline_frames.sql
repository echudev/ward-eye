-- stg_timeline_frames.sql
-- Limpia los frames del timeline y calcula CS total y fase de juego.

with source as (
    select * from {{ source('lol_raw', 'raw_timeline_frames') }}
)

select
    match_id,
    participant_id,
    timestamp_ms,
    timestamp_min,
    total_gold,
    current_gold,
    xp,
    level,
    minions_killed,
    jungle_minions,
    (minions_killed + jungle_minions)   as total_cs_at_frame,
    position_x,
    position_y,

    case
        when timestamp_min <= 14 then 'early'
        when timestamp_min <= 25 then 'mid'
        else 'late'
    end                                 as game_phase

from source
