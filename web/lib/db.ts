import "server-only";
import postgres from "postgres";

/**
 * Cliente Postgres del lado del servidor.
 *
 * Apunta al pooler de Supabase usando las mismas variables que el resto del
 * proyecto (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD). Nunca debe
 * importarse desde un Client Component: `server-only` lo garantiza en build.
 *
 * `prepare: false` mantiene la compatibilidad con el modo transaction del
 * pooler (puerto 6543) por si se cambia el puerto; en session mode (5432)
 * también funciona.
 */

declare global {
  // Reutilizamos la conexión entre hot-reloads de `next dev`.
  // eslint-disable-next-line no-var
  var __wardEyeSql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  const {
    DB_HOST,
    DB_PORT = "5432",
    DB_NAME = "postgres",
    DB_USER = "postgres",
    DB_PASSWORD,
  } = process.env;

  if (!DB_HOST || !DB_PASSWORD) {
    throw new Error(
      "Faltan variables de conexión: definí DB_HOST y DB_PASSWORD en web/.env.local",
    );
  }

  return postgres({
    host: DB_HOST,
    port: Number(DB_PORT),
    database: DB_NAME,
    username: DB_USER,
    password: DB_PASSWORD,
    ssl: "require",
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
  });
}

export const sql = globalThis.__wardEyeSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__wardEyeSql = sql;
}
