# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ward-eye — LoL coaching pipeline

Pipeline de datos personal para análisis de partidas de League of Legends con coaching automático via Claude API.

## Stack
- **Extracción**: Python + Riot Games API (Match-V5) — `extraction/`
- **Ingesta**: dlt con `write_disposition=merge`, carga incremental a DuckDB — `dlt_pipeline/`
- **Storage**: DuckDB — archivo local único `warddata.duckdb` (sin servidor; evita el sleep del free tier de Supabase)
- **Transformación**: dbt Core (staging → marts) — `dbt/`
- **Orquestación**: Prefect 3, schedule diario 23:00 ART — `flows/`
- **Coaching**: Claude API (pendiente) — `coaching/claude_coach.py` (a crear)

## Estado actual
- [x] Punto 1: extracción + dlt pipeline
- [x] Punto 2: modelos dbt
- [x] Punto 3: Prefect flow
- [ ] Punto 4: integración Claude API — implementar `coaching/claude_coach.py` y reemplazar el placeholder `generate_coaching_report()` en `flows/daily_pipeline.py`

## Comandos

```bash
# Pipeline completo (dlt + dbt + coaching)
python -m flows.daily_pipeline

# Solo ingesta dlt
python -m dlt_pipeline.pipeline

# dbt — OJO: en esta máquina dbt.exe está bloqueado por Application Control,
# invocar vía python (el flow de Prefect ya lo hace internamente)
cd dbt && python -m dbt.cli.main run --profiles-dir . && python -m dbt.cli.main test --profiles-dir .

# Registrar schedule en Prefect (una sola vez)
python -m flows.daily_pipeline deploy
```

## Variables de entorno (.env)

```
RIOT_API_KEY=RGAPI-...
RIOT_REGION=la1          # la1=LAN, la2=LAS, na1=NA, euw1=EUW
RIOT_ROUTING=americas    # americas | europe | asia
SUMMONER_NAME=...
SUMMONER_TAG=...
DUCKDB_PATH=...          # opcional; default <raíz>/warddata.duckdb (usá ruta absoluta para overridear)
ANTHROPIC_API_KEY=...    # requerido para Punto 4
```

## Arquitectura clave

### Riot API — dos niveles de routing
`RiotClient` usa dos bases de URL separadas:
- **platform** (`RIOT_REGION`, ej: `la1`): endpoints de summoner y league
- **routing** (`RIOT_ROUTING`, ej: `americas`): Match-V5 y Account endpoints

### dlt — estrategia incremental
`matches_resource` usa `dlt.sources.incremental("game_start_ts")` para cursor automático entre ejecuciones. Los recursos secundarios (`participants`, `timeline_frames`, `timeline_events`) **no usan cursor**: reciben `match_ids` calculados manualmente antes de correr el pipeline. Esto significa que en cada ejecución se re-procesan los últimos `BOOTSTRAP_MATCH_COUNT=50` matches (idempotente por `write_disposition=merge`).

### Flujo en `flows/daily_pipeline.py`
```
run_dlt_pipeline()
    └─► run_dbt()                  (wait_for dlt)
            └─► get_todays_match_ids()   (wait_for dbt — DuckDB es single-writer)
                    └─► generate_coaching_report()
```
`get_todays_match_ids()` consulta `lol_marts.mart_match_performance` filtrando por `game_date = today`. **Importante**: espera a `run_dbt` (no solo a `dlt`) porque DuckDB no permite leer el archivo mientras dbt lo está escribiendo.

### DuckDB — concurrencia (single-writer)
Un archivo `.duckdb` admite **un solo proceso escritor** a la vez; varios lectores solo conviven entre sí (no con un escritor). Implicancias:
- El pipeline (`dlt` → `dbt`) corre en serie y es el único que escribe.
- La web (`web/lib/db.ts`) abre el archivo en `READ_ONLY` **por request** y lo cierra enseguida, para no bloquear al pipeline diario. Si el pipeline está escribiendo justo en ese instante, la lectura falla y la UI degrada con elegancia.
- dbt y dlt comparten el mismo archivo vía `DUCKDB_PATH` (el flow pasa la ruta absoluta al subprocess de dbt).

### Schemas en DuckDB (archivo único `warddata.duckdb`)
- `lol_raw.*` — tablas raw (dlt): `raw_matches`, `raw_participants`, `raw_timeline_frames`, `raw_timeline_events`, `raw_summoners`
- `lol_staging.*` — vistas (dbt staging): limpian y calculan métricas derivadas (cs/min, vision/min, damage/min)
- `lol_marts.*` — tablas materializadas (dbt marts): `mart_match_performance`, `mart_champion_stats`, `mart_early_game`, `mart_player_trends`

### Punto 4 — Claude API coaching
`coaching/claude_coach.py` debe:
1. Recibir `match_ids: list[str]`
2. Consultar `lol_marts.mart_match_performance` (partidas del día) y `lol_marts.mart_champion_stats` (contexto histórico)
3. Construir prompt estructurado con las métricas
4. Llamar a `claude-sonnet-4-6` via `anthropic` SDK
5. Retornar un coaching report con: resumen, puntos fuertes, áreas de mejora, objetivos para la próxima sesión

El `anthropic` package debe agregarse a las dependencias en `pyproject.toml`.
