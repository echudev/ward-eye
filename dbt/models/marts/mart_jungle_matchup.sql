-- mart_jungle_matchup.sql
-- Una fila por partida de jungla, con el jungla rival como contraparte.
--
-- Por qué existe: el resto de la capa marts sólo tiene al jugador (1 puuid),
-- así que ninguna métrica relativa se podía calcular sin bajar a raw. Y en
-- jungla casi todo lo que importa es diferencial: el CS/min absoluto puede
-- verse normal mientras el déficit de campamentos contra el rival de esa misma
-- partida es grande.
--
-- Los snapshots salen de int_frame_snapshots (frame más cercano al hito); las
-- wards usan is_real_ward de staging (WARD_PLACED incluye trampas).

{{ config(materialized='table') }}

with me as (

    select
        match_id,
        participant_id,
        team_id,
        champion_name as my_champion,
        win
    from {{ ref('stg_participants') }}
    where is_me
      and team_position = 'JUNGLE'

),

enemy_jungler as (

    -- qualify: team_position viene de Riot y no está garantizado único.
    -- Si alguna vez llegan dos JUNGLE en el mismo equipo, sin esto el join
    -- duplicaría la partida e inflaría todos los conteos de muertes.
    select
        p.match_id,
        p.participant_id as enemy_participant_id,
        p.champion_name  as enemy_champion
    from {{ ref('stg_participants') }} p
    inner join me
        on me.match_id = p.match_id
    where p.team_id != me.team_id
      and p.team_position = 'JUNGLE'
    qualify row_number() over (
        partition by p.match_id order by p.participant_id
    ) = 1

),

my_deaths as (

    select
        e.match_id,
        e.killer_id,
        e.timestamp_min,
        -- sin asistencias = duelo perdido, no gank coordinado
        case when e.assist_count = 0 then 1 else 0 end as is_solo_death
    from {{ ref('stg_timeline_events') }} e
    inner join me
        on me.match_id = e.match_id
       and me.participant_id = e.victim_id
    where e.event_type = 'CHAMPION_KILL'

),

deaths_agg as (

    select
        d.match_id,
        count(*)                                                       as deaths_total,
        sum(d.is_solo_death)                                           as deaths_solo,
        count(*) filter (where d.timestamp_min <= 15)                  as deaths_pre15,
        sum(d.is_solo_death) filter (where d.timestamp_min <= 15)      as deaths_solo_pre15,
        sum(d.is_solo_death) filter (where d.killer_id = ej.enemy_participant_id)
                                                                       as deaths_solo_vs_jungler
    from my_deaths d
    inner join enemy_jungler ej
        on ej.match_id = d.match_id
    group by d.match_id, ej.enemy_participant_id

),

-- Diferenciales contra el jungla rival en cada hito. El inner join contra los
-- dos lados hace que un hito que no existe (partida terminada antes) no genere
-- fila, y el diferencial quede NULL abajo en vez de ser un número inventado.
diffs as (

    select
        me.match_id,
        mine.minute_mark,
        mine.jungle_minions - theirs.jungle_minions as camp_diff,
        mine.total_gold     - theirs.total_gold     as gold_diff
    from me
    inner join enemy_jungler ej
        on ej.match_id = me.match_id
    inner join {{ ref('int_frame_snapshots') }} mine
        on mine.match_id = me.match_id
       and mine.participant_id = me.participant_id
    inner join {{ ref('int_frame_snapshots') }} theirs
        on theirs.match_id = me.match_id
       and theirs.participant_id = ej.enemy_participant_id
       and theirs.minute_mark = mine.minute_mark

),

diffs_pivot as (

    select
        match_id,
        max(case when minute_mark = 10 then camp_diff end) as camp_diff_at_10,
        max(case when minute_mark = 10 then gold_diff end) as gold_diff_at_10,
        max(case when minute_mark = 15 then camp_diff end) as camp_diff_at_15,
        max(case when minute_mark = 15 then gold_diff end) as gold_diff_at_15
    from diffs
    group by match_id

),

real_wards as (

    select
        e.match_id,
        e.participant_id,
        count(*)                                        as wards_placed,
        count(*) filter (where e.timestamp_min <= 15)   as wards_pre15
    from {{ ref('stg_timeline_events') }} e
    where e.is_real_ward
    group by e.match_id, e.participant_id

)

select
    me.match_id,
    me.my_champion,
    ej.enemy_champion,
    me.win,

    -- diferenciales de tempo (NULL si la partida no llegó al hito)
    dp.camp_diff_at_10,
    dp.gold_diff_at_10,
    dp.camp_diff_at_15,
    dp.gold_diff_at_15,

    -- visión
    coalesce(mw.wards_placed, 0)                                as my_wards,
    coalesce(ew.wards_placed, 0)                                as enemy_jungler_wards,
    coalesce(mw.wards_placed, 0) - coalesce(ew.wards_placed, 0) as ward_diff,
    coalesce(mw.wards_pre15, 0)                                 as my_wards_pre15,

    -- muertes desagregadas
    coalesce(da.deaths_total, 0)                                as deaths_total,
    coalesce(da.deaths_solo, 0)                                 as deaths_solo,
    coalesce(da.deaths_pre15, 0)                                as deaths_pre15,
    coalesce(da.deaths_solo_pre15, 0)                           as deaths_solo_pre15,
    coalesce(da.deaths_solo_vs_jungler, 0)                      as deaths_solo_vs_jungler,

    -- bandera accionable: la partida se rompió en un duelo que elegiste
    coalesce(da.deaths_solo_pre15, 0) > 0                       as had_early_solo_death

from me
inner join enemy_jungler ej on ej.match_id = me.match_id
left  join deaths_agg    da on da.match_id = me.match_id
left  join diffs_pivot   dp on dp.match_id = me.match_id
left  join real_wards    mw on mw.match_id = me.match_id and mw.participant_id = me.participant_id
left  join real_wards    ew on ew.match_id = me.match_id and ew.participant_id = ej.enemy_participant_id
