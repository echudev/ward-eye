"""
Migración única: `raw_timeline_events` pasa de `primary_key` a `merge_key`.

Un evento del timeline no tiene clave natural. La primary_key anterior
—(match_id, timestamp_ms, event_type, participant_id)— incluía una columna que
es NULL en CHAMPION_KILL, BUILDING_KILL y OBJECTIVE_BOUNTY_PRESTART, y eso
rompía el merge de dlt de las dos puntas: dentro de una carga deduplicaba con
`partition by` (que agrupa NULLs como iguales, comiéndose eventos distintos), y
entre cargas borraba con `=` (que nunca matchea un NULL, dejando acumular las
filas viejas).

Hace dos cosas, ambas idempotentes:

  1. Limpia los `primary_key` que quedaron pegados en el schema guardado de dlt.
     Los hints se FUSIONAN, no se reemplazan: sacar primary_key del decorador no
     alcanza, la PK vieja sobrevive en el schema local y en el destino, y el
     delete-insert la sigue usando para deduplicar.
  2. Borra las filas que duplican un evento ya presente desde una carga
     anterior. Sólo eso: si dos filas idénticas vinieran de la MISMA carga
     serían un evento genuinamente repetido (dos pociones compradas en el mismo
     ms) y no se tocan.

    python -m scripts.migrate_timeline_events_merge_key [--db RUTA] [--dry-run]
"""

import argparse
import os
import sys

import duckdb

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.environ.get("DUCKDB_PATH", os.path.join(ROOT_DIR, "warddata.duckdb"))

TABLE = "lol_raw.raw_timeline_events"


def business_columns(conn) -> list[str]:
    """Todas las columnas del evento menos las de bookkeeping de dlt."""
    return [
        r[0]
        for r in conn.execute(
            """
            select column_name from information_schema.columns
            where table_schema = 'lol_raw' and table_name = 'raw_timeline_events'
              and column_name not like '\\_dlt\\_%' escape '\\'
            order by ordinal_position
            """
        ).fetchall()
    ]


def limpiar_hints_dlt() -> list[str]:
    """Saca los primary_key del schema guardado (local + destino) vía dlt."""
    import dlt

    pipeline = dlt.pipeline(
        pipeline_name="lol_coach",
        destination=dlt.destinations.duckdb(DEFAULT_DB),
        dataset_name="lol_raw",
    )
    schema = pipeline.default_schema
    tabla = schema.tables.get("raw_timeline_events")
    if tabla is None:
        return []

    quitados = [n for n, c in tabla["columns"].items() if c.pop("primary_key", None)]
    if quitados:
        pipeline._schema_storage.save_schema(schema)
        pipeline.sync_schema()
    return quitados


def deduplicar(conn, dry_run: bool) -> int:
    cols = business_columns(conn)
    particion = ", ".join(cols)

    # Una fila sobra si repite todas las columnas de negocio de un evento que ya
    # existía en una carga anterior. `partition by` agrupa NULLs como iguales,
    # que es justo lo que hace falta acá.
    sobrantes = f"""
        select _dlt_id from (
            select _dlt_id, _dlt_load_id,
                   min(_dlt_load_id) over (partition by {particion}) as primera_carga
            from {TABLE}
        ) where _dlt_load_id <> primera_carga
    """

    n = conn.execute(f"select count(*) from ({sobrantes})").fetchone()[0]
    if n and not dry_run:
        conn.execute(f"delete from {TABLE} where _dlt_id in ({sobrantes})")
    return n


def migrate(db_path: str, dry_run: bool) -> int:
    if not os.path.exists(db_path):
        print(f"No existe {db_path} - nada que migrar.")
        return 0

    conn = duckdb.connect(db_path, read_only=dry_run)
    try:
        antes = conn.execute(f"select count(*) from {TABLE}").fetchone()[0]
        n = deduplicar(conn, dry_run)
        despues = conn.execute(f"select count(*) from {TABLE}").fetchone()[0]
    finally:
        conn.close()

    if dry_run:
        print(f"[dry-run] {antes} filas; se borrarian {n}. Sin cambios.")
        return 0

    print(f"Filas duplicadas entre cargas borradas: {n} ({antes} -> {despues}).")

    quitados = limpiar_hints_dlt()
    print(
        f"primary_key removidos del schema de dlt: {quitados}"
        if quitados
        else "El schema de dlt ya estaba limpio."
    )
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DEFAULT_DB, help="ruta al archivo .duckdb")
    ap.add_argument("--dry-run", action="store_true", help="sólo reportar")
    args = ap.parse_args()
    sys.exit(migrate(args.db, args.dry_run))
