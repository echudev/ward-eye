# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ward-eye — LoL coaching pipeline

Pipeline de datos personal para análisis de partidas de League of Legends con coaching automático vía LLM, expuesto en un dashboard web.

## Stack
- **Extracción**: Python + Riot Games API (Match-V5) — `extraction/`
- **Ingesta**: dlt con `write_disposition=merge`, carga incremental a DuckDB — `dlt_pipeline/`
- **Storage**: DuckDB — archivo local único `warddata.duckdb` (sin servidor; evita el sleep del free tier de Supabase)
- **Transformación**: dbt Core (staging → marts) — `dbt/`
- **Orquestación**: Prefect 3, schedule diario 23:00 ART — `flows/`
- **Dashboard + coaching**: Next.js 16 + React 19 + ECharts; coaching on-demand vía endpoint LLM OpenAI-compatible (SDK `openai`) — `web/`

## Estado actual
- [x] Punto 1: extracción + dlt pipeline
- [x] Punto 2: modelos dbt
- [x] Punto 3: Prefect flow
- [x] Punto 4: coaching vía LLM — **implementado como dashboard web en `web/`**, NO como `coaching/claude_coach.py`. Ver "Coaching (web)" más abajo.

> **OJO**: el placeholder `generate_coaching_report()` en `flows/daily_pipeline.py` sigue existiendo y NO genera coaching real. El coaching corre desde el frontend (`web/`), independiente del flow diario de Prefect.

## Comandos

```bash
# Pipeline completo (dlt → dbt; el coaching del flow es solo un placeholder)
python -m flows.daily_pipeline

# Solo ingesta dlt
python -m dlt_pipeline.pipeline

# dbt — OJO: en esta máquina dbt.exe está bloqueado por Application Control,
# invocar vía python (el flow de Prefect ya lo hace internamente)
cd dbt && python -m dbt.cli.main run --profiles-dir . && python -m dbt.cli.main test --profiles-dir .

# Registrar schedule en Prefect (una sola vez)
python -m flows.daily_pipeline deploy

# Dashboard web (coaching real)
cd web && npm install && npm run dev   # http://localhost:3000
```

## Variables de entorno

### Pipeline — `.env` (raíz)

```
RIOT_API_KEY=RGAPI-...
RIOT_REGION=la1          # la1=LAN, la2=LAS, na1=NA, euw1=EUW
RIOT_ROUTING=americas    # americas | europe | asia | sea
SUMMONER_NAME=...
SUMMONER_TAG=...
DUCKDB_PATH=...          # opcional; default <raíz>/warddata.duckdb (usá ruta absoluta para overridear)
```

### Coaching — `web/.env.local`

El LLM se configura 100% por env (sin acoplar proveedor). Default: free tier de Groq.

```
LLM_BASE_URL=...         # endpoint OpenAI-compatible (default Groq)
LLM_API_KEY=...          # key del proveedor
LLM_MODEL=...            # modelo a usar
LLM_REASONING_EFFORT=... # opcional: low | medium | high (modelos de razonamiento)
DUCKDB_PATH=...          # opcional; default ../warddata.duckdb (relativo a web/)
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
                    └─► generate_coaching_report()   (placeholder — no genera coaching)
```
`get_todays_match_ids()` consulta `lol_marts.mart_match_performance` filtrando por `game_date = today`. **Importante**: espera a `run_dbt` (no solo a `dlt`) porque DuckDB no permite leer el archivo mientras dbt lo está escribiendo. `generate_coaching_report()` solo loguea los match_ids del día; el coaching real vive en `web/` (ver más abajo).

### DuckDB — concurrencia (single-writer)
Un archivo `.duckdb` admite **un solo proceso escritor** a la vez; varios lectores solo conviven entre sí (no con un escritor). Implicancias:
- El pipeline (`dlt` → `dbt`) corre en serie y es el único que escribe.
- La web (`web/lib/db.ts`) abre el archivo en `READ_ONLY` **por request** y lo cierra enseguida, para no bloquear al pipeline diario. Si el pipeline está escribiendo justo en ese instante, la lectura falla y la UI degrada con elegancia.
- dbt y dlt comparten el mismo archivo vía `DUCKDB_PATH` (el flow pasa la ruta absoluta al subprocess de dbt).

### Schemas en DuckDB (archivo único `warddata.duckdb`)
- `lol_raw.*` — tablas raw (dlt): `raw_matches`, `raw_participants`, `raw_timeline_frames`, `raw_timeline_events`, `raw_summoners`
- `lol_staging.*` — vistas (dbt staging): limpian y calculan métricas derivadas (cs/min, vision/min, damage/min)
- `lol_marts.*` — tablas materializadas (dbt marts): `mart_match_performance`, `mart_champion_stats`, `mart_early_game`, `mart_player_trends`

### Coaching (web)
El coaching se implementó como **dashboard Next.js en `web/`** (no como `coaching/claude_coach.py`, que nunca se creó). Detalles en `web/README.md` y `web/CLAUDE.md`. Puntos clave:

- **Datos**: server-side, lee los marts (`lol_marts.*`) del archivo DuckDB en `READ_ONLY` por request (`web/lib/db.ts`, `web/lib/queries.ts`). El acceso nunca llega al cliente (`server-only`).
- **Gráficos**: Apache ECharts vía wrapper propio `web/components/EChart.tsx` (sin `echarts-for-react` por peer-deps con React 19).
- **Coaching on-demand**: botón → `POST /api/coaching` → `web/lib/coach.ts`. Usa el SDK `openai` contra un endpoint **OpenAI-compatible** configurable por env (`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`). Default Groq free tier; swappear a Claude = solo cambiar esas vars (Anthropic expone endpoint OpenAI-compatible) o reemplazar `lib/coach.ts` por el SDK `@anthropic-ai/sdk`.
- El prompt arma bloques: comparación Victorias vs Derrotas, early game, tendencia semanal, partidas recientes y campeones; calibrado al rol principal del jugador. Devuelve Markdown con secciones fijas (Resumen / Puntos fuertes / Áreas de mejora / Objetivos próxima sesión).

> `web/` corre Next.js 16 con su propia copia de docs en `node_modules/next/dist/docs/` (ver `web/AGENTS.md`): tiene breaking changes respecto a versiones previas, leé la guía relevante antes de tocar código del frontend.
