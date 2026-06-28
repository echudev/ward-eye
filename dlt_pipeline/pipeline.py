"""
Pipeline dlt: extrae datos de la Riot API y los carga en PostgreSQL (Supabase).

Estrategia incremental:
  - raw_matches usa match_id como clave de merge → nunca duplica partidas
  - raw_summoners usa puuid como clave → actualiza el estado ranked
  - raw_participants, raw_timeline_frames, raw_timeline_events
    usan merge por (match_id, ...) → idempotente ante re-ejecuciones

Cómo correr manualmente:
  python -m dlt_pipeline.pipeline
"""

import logging
import os
import sys

import dlt
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from extraction.riot_client import RiotClient
from extraction.transformers import (
    parse_match,
    parse_participants,
    parse_summoner,
    parse_timeline_events,
    parse_timeline_frames,
)

load_dotenv(override=True)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config desde .env
# ---------------------------------------------------------------------------
RIOT_API_KEY = os.environ["RIOT_API_KEY"].strip()
RIOT_REGION = os.environ.get("RIOT_REGION", "la2").strip()
RIOT_ROUTING = os.environ.get("RIOT_ROUTING", "americas").strip()
SUMMONER_NAME = os.environ["SUMMONER_NAME"].strip()
SUMMONER_TAG = os.environ["SUMMONER_TAG"].strip()

DB_HOST = os.environ["DB_HOST"]
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "postgres")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ["DB_PASSWORD"]

# Cuántas partidas atrás buscar en la primera ejecución (bootstrap)
BOOTSTRAP_MATCH_COUNT = 50


# ---------------------------------------------------------------------------
# Fuentes dlt
# ---------------------------------------------------------------------------


@dlt.resource(
    name="raw_matches",
    write_disposition="merge",
    primary_key="match_id",
)
def matches_resource(
    client: RiotClient,
    puuid: str,
    last_game_start_ts=dlt.sources.incremental(
        "game_start_ts",
        initial_value=0,
    ),
):
    """
    Recurso incremental: solo trae partidas más nuevas que la última cargada.
    dlt rastrea automáticamente el máximo de game_start_ts entre ejecuciones.
    """
    # Convertimos el cursor de ms a segundos para la API de Riot
    start_time_s = (last_game_start_ts.last_value or 0) // 1000

    logger.info(f"Buscando partidas desde epoch {start_time_s}...")
    match_ids = client.get_match_ids(
        puuid=puuid,
        start_time=start_time_s if start_time_s > 0 else None,
        count=BOOTSTRAP_MATCH_COUNT,
    )
    logger.info(f"Encontradas {len(match_ids)} partidas nuevas")

    for match_id in match_ids:
        logger.info(f"Procesando {match_id}...")
        raw = client.get_match(match_id)
        yield parse_match(raw, puuid)


@dlt.resource(
    name="raw_participants",
    write_disposition="merge",
    primary_key=["match_id", "puuid"],
)
def participants_resource(client: RiotClient, puuid: str, match_ids: list[str]):
    for match_id in match_ids:
        raw = client.get_match(match_id)
        yield from parse_participants(raw, puuid)


@dlt.resource(
    name="raw_timeline_frames",
    write_disposition="merge",
    primary_key=["match_id", "participant_id", "timestamp_ms"],
)
def timeline_frames_resource(client: RiotClient, match_ids: list[str]):
    for match_id in match_ids:
        logger.info(f"Timeline frames: {match_id}")
        raw_tl = client.get_match_timeline(match_id)
        yield from parse_timeline_frames(raw_tl, match_id)


@dlt.resource(
    name="raw_timeline_events",
    write_disposition="merge",
    primary_key=["match_id", "timestamp_ms", "event_type", "participant_id"],
    columns={"participant_id": {"nullable": True, "data_type": "bigint"}},
)
def timeline_events_resource(client: RiotClient, match_ids: list[str]):
    for match_id in match_ids:
        logger.info(f"Timeline events: {match_id}")
        raw_tl = client.get_match_timeline(match_id)
        yield from parse_timeline_events(raw_tl, match_id)


@dlt.resource(
    name="raw_summoners",
    write_disposition="merge",
    primary_key="puuid",
)
def summoner_resource(client: RiotClient, puuid: str):
    summoner = client.get_summoner_by_puuid(puuid)
    ranked = client.get_ranked_info(puuid)
    yield parse_summoner(summoner, puuid, ranked)


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------


def build_destination():
    """Construye el destino dlt para PostgreSQL desde variables de entorno."""
    conn_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    return dlt.destinations.postgres(conn_string)


def run_pipeline():
    client = RiotClient(
        api_key=RIOT_API_KEY,
        platform=RIOT_REGION,
        routing=RIOT_ROUTING,
    )

    # 1. Resolvemos el PUUID del jugador
    logger.info(f"Resolviendo PUUID para {SUMMONER_NAME}#{SUMMONER_TAG}...")
    puuid = client.get_puuid(SUMMONER_NAME, SUMMONER_TAG)
    logger.info(f"PUUID: {puuid}")

    # 2. Traemos los match IDs nuevos (para pasarlos a los recursos secundarios)
    #    dlt manejará el cursor incremental internamente en matches_resource,
    #    pero necesitamos la lista para cargar participants y timelines.
    #    Usamos start_time=0 en bootstrap; en corridas siguientes el cursor
    #    de dlt filtra automáticamente.
    match_ids = client.get_match_ids(puuid=puuid, count=BOOTSTRAP_MATCH_COUNT)
    logger.info(f"Match IDs a procesar: {len(match_ids)}")

    # 3. Construimos el pipeline dlt
    pipeline = dlt.pipeline(
        pipeline_name="lol_coach",
        destination=build_destination(),
        dataset_name="lol_raw",  # schema en PostgreSQL
        progress="log",
    )

    # 4. Cargamos todos los recursos en una sola ejecución
    load_info = pipeline.run(
        [
            matches_resource(client, puuid),
            participants_resource(client, puuid, match_ids),
            timeline_frames_resource(client, match_ids),
            timeline_events_resource(client, match_ids),
            summoner_resource(client, puuid),
        ]
    )

    logger.info(f"Pipeline completado:\n{load_info}")
    return load_info


if __name__ == "__main__":
    run_pipeline()
