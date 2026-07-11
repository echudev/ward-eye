"""
Backfill puntual: agrega `participant_id` a las filas de raw_participants ya
cargadas antes de que el extractor lo capturara.

Re-descarga el detalle de cada partida ya presente en raw_matches (vía la
Riot API) y vuelve a cargar raw_participants con merge (primary_key
match_id+puuid), lo que actualiza in-place las filas existentes agregando el
participant_id real. No toca raw_matches ni los timelines.

Correr una sola vez:
  python -m dlt_pipeline.backfill_participant_id
"""

import logging
import os
import sys

import dlt
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from extraction.riot_client import RiotClient
from dlt_pipeline.pipeline import (
    DUCKDB_PATH,
    RIOT_API_KEY,
    RIOT_REGION,
    RIOT_ROUTING,
    SUMMONER_NAME,
    SUMMONER_TAG,
    build_destination,
    participants_resource,
)

load_dotenv(override=True)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def run_backfill():
    import duckdb

    conn = duckdb.connect(DUCKDB_PATH, read_only=True)
    try:
        match_ids = [
            r[0] for r in conn.execute("SELECT match_id FROM lol_raw.raw_matches").fetchall()
        ]
    finally:
        conn.close()

    logger.info(f"Partidas a re-procesar para backfill de participant_id: {len(match_ids)}")

    client = RiotClient(api_key=RIOT_API_KEY, platform=RIOT_REGION, routing=RIOT_ROUTING)
    puuid = client.get_puuid(SUMMONER_NAME, SUMMONER_TAG)

    pipeline = dlt.pipeline(
        pipeline_name="lol_coach",
        destination=build_destination(),
        dataset_name="lol_raw",
        progress="log",
    )
    load_info = pipeline.run([participants_resource(client, puuid, match_ids)])
    logger.info(f"Backfill completado:\n{load_info}")
    return load_info


if __name__ == "__main__":
    run_backfill()
