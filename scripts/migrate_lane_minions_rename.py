"""
Migración única: `raw_participants.cs_per_minute` → `lane_minions_first_10min`.

Por qué: la columna nunca fue un ratio de CS por minuto. Viene de
`challenges.laneMinionsFirst10Minutes` — súbditos de LÍNEA en los primeros 10
minutos, que para un jungla son 0-5. El nombre invitaba a leerla como ratio y a
compararla contra `cs_per_min` (ese sí es un ratio, recalculado en staging), y
el BIGINT inferido por dlt parecía un truncamiento cuando en realidad el tipo
era correcto.

Hace el rename en DuckDB preservando el histórico (1170 filas), en vez de dejar
que dlt agregue la columna nueva en NULL y abandone la vieja con los datos
adentro. `participants_resource` declara la columna en su hint `columns={...}`,
así que dlt ya la conoce y no intenta re-crearla.

Idempotente: si ya está migrada, no hace nada.

    python -m scripts.migrate_lane_minions_rename [--db RUTA]
"""

import argparse
import os
import sys

import duckdb

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.environ.get("DUCKDB_PATH", os.path.join(ROOT_DIR, "warddata.duckdb"))

OLD = "cs_per_minute"
NEW = "lane_minions_first_10min"
TABLE = "lol_raw.raw_participants"


def columns(conn) -> set[str]:
    return {
        r[0]
        for r in conn.execute(
            """
            select column_name from information_schema.columns
            where table_schema = 'lol_raw' and table_name = 'raw_participants'
            """
        ).fetchall()
    }


def migrate(db_path: str) -> int:
    if not os.path.exists(db_path):
        print(f"No existe {db_path} — nada que migrar.")
        return 0

    conn = duckdb.connect(db_path)
    try:
        cols = columns(conn)

        if NEW in cols and OLD not in cols:
            print(f"Ya migrada: {TABLE}.{NEW} existe y {OLD} no. Nada que hacer.")
            return 0

        if OLD not in cols:
            print(f"No hay ni {OLD} ni {NEW} en {TABLE} — revisá el estado a mano.")
            return 1

        if NEW in cols:
            # Caso raro: dlt ya agregó la columna nueva (en NULL) antes de correr
            # esta migración. Rellenamos desde la vieja y descartamos la vieja.
            print(f"Ambas columnas presentes: backfill {NEW} desde {OLD}.")
            conn.execute(
                f"update {TABLE} set {NEW} = {OLD} where {NEW} is null and {OLD} is not null"
            )
            conn.execute(f"alter table {TABLE} drop column {OLD}")
        else:
            print(f"Renombrando {TABLE}.{OLD} -> {NEW}...")
            conn.execute(f"alter table {TABLE} rename column {OLD} to {NEW}")

        filas, no_nulos, maximo = conn.execute(
            f"select count(*), count({NEW}), max({NEW}) from {TABLE}"
        ).fetchone()
        print(f"OK — {filas} filas, {no_nulos} con valor, máximo {maximo}.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB, help="ruta al archivo .duckdb")
    sys.exit(migrate(ap.parse_args().db))
