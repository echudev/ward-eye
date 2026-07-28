-- mart_objective_control.sql
-- Una fila por partida: quién se llevó cada objetivo neutral, mi bando o el rival.
--
-- Igual que mart_jungle_matchup, esto no se podía calcular en la capa marts
-- porque el resto de los modelos sólo tienen al jugador. Los objetivos son la
-- señal más fuerte del dataset y son inherentemente por-bando.
--
-- ELITE_MONSTER_KILL sólo trae killer_id (nunca NULL en los datos), así que el
-- bando sale de unir contra el participante que lo mató.

with me as (

    select match_id, team_id as my_team_id, win
    from {{ ref('stg_participants') }}
    where is_me

),

-- participant_id -> team_id, para atribuir cada objetivo a un bando
participant_team as (

    select match_id, participant_id, team_id
    from {{ ref('stg_participants') }}

),

objectives as (

    select
        e.match_id,
        e.timestamp_min,
        e.monster_type,
        e.monster_subtype,
        pt.team_id = me.my_team_id as is_mine,
        row_number() over (
            partition by e.match_id, e.monster_type
            order by e.timestamp_min, e.timestamp_ms
        ) as nth_of_type
    from {{ ref('stg_timeline_events') }} e
    inner join me
        on me.match_id = e.match_id
    inner join participant_team pt
        on pt.match_id = e.match_id
       and pt.participant_id = e.killer_id
    where e.event_type = 'ELITE_MONSTER_KILL'

)

select
    me.match_id,
    me.win,

    -- Primer dragón: el corte con más señal del dataset
    max(case when o.monster_type = 'DRAGON' and o.nth_of_type = 1
             then o.is_mine end)                                as first_dragon_mine,
    max(case when o.monster_type = 'DRAGON' and o.nth_of_type = 1
             then o.timestamp_min end)                          as first_dragon_min,

    -- Heraldo (primero) y Barón (primero)
    max(case when o.monster_type = 'RIFTHERALD' and o.nth_of_type = 1
             then o.is_mine end)                                as first_herald_mine,
    max(case when o.monster_type = 'BARON_NASHOR' and o.nth_of_type = 1
             then o.is_mine end)                                as first_baron_mine,

    -- Conteos por bando. HORDE = larvas del vacío (grubs), van de a varias.
    count(*) filter (where o.monster_type = 'DRAGON'       and o.is_mine)        as dragons_mine,
    count(*) filter (where o.monster_type = 'DRAGON'       and not o.is_mine)    as dragons_enemy,
    count(*) filter (where o.monster_type = 'HORDE'        and o.is_mine)        as grubs_mine,
    count(*) filter (where o.monster_type = 'HORDE'        and not o.is_mine)    as grubs_enemy,
    count(*) filter (where o.monster_type = 'RIFTHERALD'   and o.is_mine)        as heralds_mine,
    count(*) filter (where o.monster_type = 'RIFTHERALD'   and not o.is_mine)    as heralds_enemy,
    count(*) filter (where o.monster_type = 'BARON_NASHOR' and o.is_mine)        as barons_mine,
    count(*) filter (where o.monster_type = 'BARON_NASHOR' and not o.is_mine)    as barons_enemy,

    -- Diferenciales, que es como se lee un matchup
    count(*) filter (where o.monster_type = 'DRAGON' and o.is_mine)
      - count(*) filter (where o.monster_type = 'DRAGON' and not o.is_mine)      as dragon_diff,
    count(*) filter (where o.monster_type = 'HORDE'  and o.is_mine)
      - count(*) filter (where o.monster_type = 'HORDE'  and not o.is_mine)      as grub_diff

from me
left join objectives o
    on o.match_id = me.match_id
group by me.match_id, me.win
