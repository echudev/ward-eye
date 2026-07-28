-- Centinela del filtro is_real_ward.
--
-- WARD_PLACED en el timeline incluye trampas y objetos de campeón (cajas de
-- Shaco, hongos de Teemo), que llevaban el conteo hasta 730 wards de más en una
-- sola partida. En vez de un umbral mágico, contrastamos contra una fuente
-- independiente: `wards_placed` viene del endpoint Match-V5, no del timeline.
--
-- Con el filtro puesto, 1166 de 1170 participantes coinciden exacto y los 4
-- restantes difieren en 1 (wards colocadas sobre el cierre de la partida).
-- Toleramos 2; cualquier cosa por encima significa que el filtro se rompió.

with timeline_wards as (

    select
        match_id,
        participant_id,
        count(*) as wards_from_timeline
    from {{ ref('stg_timeline_events') }}
    where is_real_ward
    group by 1, 2

)

select
    p.match_id,
    p.participant_id,
    p.wards_placed as wards_from_match_api,
    coalesce(t.wards_from_timeline, 0) as wards_from_timeline
from {{ ref('stg_participants') }} p
left join timeline_wards t
    on t.match_id = p.match_id
   and t.participant_id = p.participant_id
where abs(p.wards_placed - coalesce(t.wards_from_timeline, 0)) > 2
