-- stg_timeline_events.sql
-- Limpia los eventos del timeline. Sin transformaciones pesadas;
-- los marts filtran por event_type según lo que necesitan.
--
-- Excepción: `is_real_ward`. WARD_PLACED no significa "ward de visión" — Riot
-- mete ahí las trampas y objetos de campeón (cajas de Shaco, hongos de Teemo,
-- trampas de Jhin/Nidalee) bajo ward_type UNDEFINED / TEEMO_MUSHROOM, que son
-- ~64% de los eventos. Contarlos infla la visión hasta 7x. El filtro canónico
-- vive acá para que ningún mart lo reimplemente (ni lo reimplemente mal).

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

    -- assisting_ids llega como VARCHAR con JSON adentro y usa '[]' para "sin
    -- asistencias", nunca NULL. Lo parseamos a array nativo para poder unir
    -- contra participantes en vez de comparar strings; `assist_count = 0` es el
    -- filtro correcto para "muerte en duelo, no gank coordinado".
    assisting_ids,
    from_json(assisting_ids, '["BIGINT"]')      as assisting_participant_ids,
    coalesce(len(from_json(assisting_ids, '["BIGINT"]')), 0)
                                                as assist_count,

    item_id,
    skill_slot,
    level_up_type,
    building_type,
    lane_type,
    tower_type,
    monster_type,
    monster_subtype,
    ward_type,

    event_type = 'WARD_PLACED'
        and ward_type in ('YELLOW_TRINKET', 'SIGHT_WARD', 'CONTROL_WARD', 'BLUE_TRINKET')
                                        as is_real_ward,

    position_x,
    position_y,
    bounty,
    shutdown_bounty

from source
