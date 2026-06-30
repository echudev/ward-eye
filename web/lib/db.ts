import "server-only";
import path from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

/**
 * Acceso de solo-lectura al archivo DuckDB local del proyecto.
 *
 * El pipeline (dlt + dbt) es el único que ESCRIBE el archivo; la web solo LEE.
 * DuckDB no permite abrir un archivo en lectura mientras otro proceso lo tiene
 * abierto en escritura, así que abrimos en modo READ_ONLY y por request (sin
 * handle persistente): la ventana de lock queda en milisegundos y no bloquea al
 * pipeline diario. Si el pipeline está escribiendo justo en ese instante, la
 * lectura falla y la UI degrada con elegancia (ver getDashboardData).
 *
 * DUCKDB_PATH puede ser absoluto o relativo al cwd de la web (web/).
 * Default: ../warddata.duckdb (raíz del proyecto).
 */

const DB_PATH = path.resolve(
  process.cwd(),
  process.env.DUCKDB_PATH ?? "../warddata.duckdb",
);

export type Run = <T>(
  sql: string,
  params?: (number | string | boolean | null)[],
) => Promise<T[]>;

/**
 * Abre el archivo en READ_ONLY, ejecuta `fn` con un runner de queries y cierra
 * todo al terminar. Cada query usa su propia conexión sobre la misma instancia,
 * lo que permite correr varias en paralelo (Promise.all).
 */
export async function withRun<T>(fn: (run: Run) => Promise<T>): Promise<T> {
  const instance = await DuckDBInstance.create(DB_PATH, {
    access_mode: "READ_ONLY",
  });
  try {
    const run: Run = async <R>(
      sql: string,
      params: (number | string | boolean | null)[] = [],
    ): Promise<R[]> => {
      const connection = await instance.connect();
      try {
        const reader = await connection.runAndReadAll(sql, params);
        return reader.getRowObjects() as R[];
      } finally {
        connection.disconnectSync();
      }
    };
    return await fn(run);
  } finally {
    instance.closeSync();
  }
}
