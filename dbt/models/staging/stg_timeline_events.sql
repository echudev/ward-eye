-- stg_timeline_events.sql
-- Limpia los eventos del timeline. Sin transformaciones pesadas;
-- los marts filtran por event_type según lo que necesitan.

with source as (
    select * from {{ source('lol_raw', 'raw_timeline_events') }}
)

select
    match_id,
    timestamp_ms,
    timestamp_min,
    event_type,
    participant_id,
    killer_id,
    victim_id,
    assisting_ids,
    item_id,
    skill_slot,
    level_up_type,
    building_type,
    lane_type,
    tower_type,
    monster_type,
    monster_subtype,
    ward_type,
    position_x,
    position_y,
    bounty,
    shutdown_bounty

from source
