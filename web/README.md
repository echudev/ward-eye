# ward-eye · web

Dashboard Next.js que consume los marts de dbt (`lol_marts.*`) desde el archivo
DuckDB local del proyecto, los grafica con Apache ECharts y genera coaching
automático vía un endpoint LLM OpenAI-compatible (Groq por defecto, swappeable a
Claude/OpenAI por env).

## Arquitectura

```
app/page.tsx ──(server)──► lib/queries.ts ──► lib/db.ts ──► DuckDB (lol_marts)
     │                                                     (warddata.duckdb, READ_ONLY)
     ├─ components/Kpis, charts/* (ECharts, client)
     └─ components/CoachingPanel (client)
              └─ POST /api/coaching ──► lib/coach.ts ──► LLM (OpenAI SDK → Groq)
```

- **Datos**: server-side con `@duckdb/node-api`, abriendo el archivo en modo
  READ_ONLY por request (no bloquea al pipeline, que es el único escritor). El
  acceso nunca llega al cliente (`server-only`).
- **Gráficos**: `echarts` envuelto en `components/EChart.tsx` (client component;
  ECharts se importa dinámicamente para no romper el SSR).
- **Coaching**: SDK `openai` apuntando a `LLM_BASE_URL`. Cambiar de proveedor es
  solo cambiar variables de entorno.

## Setup

```bash
cp .env.example .env.local   # completá LLM_API_KEY (Groq); DuckDB usa ../warddata.duckdb por default
npm install
npm run dev                  # http://localhost:3000
```

Obtené una API key gratis en https://console.groq.com/keys

## Variables de entorno

| Variable       | Descripción                                            |
| -------------- | ------------------------------------------------------ |
| `DUCKDB_PATH`  | (Opcional) Ruta del archivo DuckDB; default `../warddata.duckdb` |
| `LLM_BASE_URL`         | Endpoint OpenAI-compatible (default Groq)                       |
| `LLM_API_KEY`          | API key del proveedor                                           |
| `LLM_MODEL`            | Modelo (default `openai/gpt-oss-120b`)                          |
| `LLM_REASONING_EFFORT` | Solo modelos de razonamiento: `low`/`medium`/`high` (opcional)  |

## Swappear a Claude

```env
LLM_BASE_URL=https://api.anthropic.com/v1/
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-sonnet-4-6
```

> Anthropic expone un endpoint OpenAI-compatible. Alternativamente, reemplazá
> `lib/coach.ts` por el SDK `@anthropic-ai/sdk`.
