-- El grain de int_frame_snapshots es (match_id, participant_id, minute_mark).
-- Si se duplica, todo diferencial construido encima se cuenta doble.

select
    match_id,
    participant_id,
    minute_mark,
    count(*) as filas
from {{ ref('int_frame_snapshots') }}
group by 1, 2, 3
having count(*) > 1
