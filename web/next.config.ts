import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @duckdb/node-api carga un binding nativo (.node) que NO se puede bundlear.
  // Lo sacamos del bundle de Server Components para que se resuelva con el
  // `require` nativo de Node en runtime (si no, Turbopack intenta resolver el
  // binding de todas las plataformas, ej. darwin-arm64, y falla).
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
