# LoL Coach — Pipeline de datos

Pipeline de ingestión de partidas de League of Legends hacia un archivo DuckDB
local (`warddata.duckdb`), con análisis automático via LLM.

## Setup

### 1. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editá .env con tus credenciales
```

Variables requeridas:

| Variable | Descripción | Ejemplo |
|---|---|---|
| `RIOT_API_KEY` | Personal API Key de Riot | `RGAPI-xxxx...` |
| `RIOT_REGION` | Platform de tu servidor | `la1` (LAN), `la2` (LAS), `na1`, `euw1` |
| `RIOT_ROUTING` | Regional routing para Match-V5 | `americas` (LAN/LAS/NA), `europe`, `asia` |
| `SUMMONER_NAME` | Tu nombre de invocador (sin el #tag) | `MiNombre` |
| `SUMMONER_TAG` | Tu tag de Riot ID | `LAN` |
| `DUCKDB_PATH` | (Opcional) Ruta del archivo DuckDB | default `<raíz>/warddata.duckdb` |

**Regiones:**
- LAN → `RIOT_REGION=la1`, `RIOT_ROUTING=americas`
- LAS → `RIOT_REGION=la2`, `RIOT_ROUTING=americas`
- NA  → `RIOT_REGION=na1`, `RIOT_ROUTING=americas`
- EUW → `RIOT_REGION=euw1`, `RIOT_ROUTING=europe`

### 3. Primer ejecución (bootstrap)

Carga las últimas 50 partidas:

```bash
cd lol_coach
python -m dlt_pipeline.pipeline
```

dlt crea las tablas automáticamente en el schema `lol_raw` de tu base de datos.

### 4. Ejecuciones siguientes

Cada ejecución solo carga partidas nuevas (incrementales).
dlt guarda el cursor en `.dlt/` localmente.

## Tablas creadas en DuckDB (schema `lol_raw`)

```
lol_raw.raw_matches            -- Una fila por partida
lol_raw.raw_participants       -- 10 filas por partida (un jugador por fila)
lol_raw.raw_timeline_frames    -- ~200 filas por partida (estado por minuto)
lol_raw.raw_timeline_events    -- Variable (kills, items, objetivos, etc.)
lol_raw.raw_summoners          -- Una fila por jugador (estado ranked actual)
```

## Estructura del proyecto

```
lol_coach/
├── .env.example
├── requirements.txt
├── extraction/
│   ├── riot_client.py      # Cliente HTTP para Riot API
│   └── transformers.py     # Parsers: API response → registros planos
└── dlt_pipeline/
    └── pipeline.py         # Pipeline dlt con carga incremental
```

## Próximos pasos

- `dbt/` — Modelos de transformación (staging + marts)
- `flows/` — Prefect flow con schedule diario
- `coaching/` — Integración Claude API para análisis post-partida
