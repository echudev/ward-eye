-- Ningún snapshot puede estar a más de 1.5 min de su hito: si la partida
-- terminó antes, el frame más cercano no representa el hito y la fila no
-- debería existir.

select
    match_id,
    participant_id,
    minute_mark,
    actual_frame_min
from {{ ref('int_frame_snapshots') }}
where abs(actual_frame_min - minute_mark) > 1.5
