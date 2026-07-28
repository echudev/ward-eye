-- Reconciliación raw -> marts (Gap 5).
--
-- La diferencia entre raw y marts es intencional: stg_matches descarta partidas
-- de <5 min (remakes). Pero ese filtro es la ÚNICA merma aceptable. Si mañana un
-- join se rompe y se pierden partidas en silencio, el volumen del mart cae sin
-- que nada falle — este test lo convierte en un error.
--
-- Compara: partidas del jugador en raw que superan el umbral de remake, vs
-- filas en mart_match_performance.

with esperado as (

    select count(distinct p.match_id) as n
    from {{ source('lol_raw', 'raw_participants') }} p
    inner join {{ source('lol_raw', 'raw_matches') }} m
        on m.match_id = p.match_id
    where p.is_me
      and m.game_duration_s >= 300

),

obtenido as (

    select count(*) as n from {{ ref('mart_match_performance') }}

)

select
    esperado.n as partidas_validas_en_raw,
    obtenido.n as filas_en_mart
from esperado
cross join obtenido
where esperado.n != obtenido.n
