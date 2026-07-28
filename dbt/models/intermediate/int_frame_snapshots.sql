-- int_frame_snapshots.sql
-- Snapshot de recursos de cada participante en los hitos de minuto habituales.
--
-- Por qué existe: los frames del timeline NO caen en minutos enteros. Riot los
-- emite cada ~60s pero con drift acumulado, así que los valores reales son
-- 5.00, 13.01, 14.01, 15.01, 17.01, 20.01... Cualquier lookup por igualdad
-- exacta (`timestamp_min = 15`) pierde ~2/3 de las partidas, y un lookup por
-- rango con max() (`between 14 and 16`) se queda con el frame MÁS TARDÍO de la
-- ventana, no con el más cercano al hito — sobreestimando el snapshot en
-- ~1 minuto de oro/CS.
--
-- Este modelo resuelve el lookup una sola vez, por frame más cercano, para que
-- los marts no lo repitan (ni lo repitan mal).

with marks as (

    select * from (values (5), (10), (15), (20), (25)) as t(minute_mark)

),

frames as (

    -- Sólo los frames que pueden ganar algún hito: ningún mark supera 25 y la
    -- tolerancia es 1.5, así que arriba de 26.5 no hay nada que aportar.
    select *
    from {{ ref('stg_timeline_frames') }}
    where timestamp_min <= 26.5

),

ranked as (

    select
        f.match_id,
        f.participant_id,
        m.minute_mark,
        f.timestamp_min,
        f.total_gold,
        f.current_gold,
        f.xp,
        f.level,
        f.minions_killed,
        f.jungle_minions,
        f.total_cs_at_frame,
        row_number() over (
            partition by f.match_id, f.participant_id, m.minute_mark
            -- desempate por timestamp: ante dos frames equidistantes preferimos
            -- el anterior, para no acreditar recursos que todavía no existían
            order by abs(f.timestamp_min - m.minute_mark), f.timestamp_min
        ) as rn
    from frames f
    cross join marks m

)

select
    match_id,
    participant_id,
    minute_mark,
    timestamp_min as actual_frame_min,
    total_gold,
    current_gold,
    xp,
    level,
    minions_killed,
    jungle_minions,
    total_cs_at_frame

from ranked
where rn = 1
  -- descarta hitos extrapolados: si la partida terminó en el 12, no existe un
  -- snapshot @15 y el frame más cercano sería una mentira
  and abs(timestamp_min - minute_mark) <= 1.5
