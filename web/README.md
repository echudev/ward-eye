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
              └─ POST /api/coaching ──► lib/coach.ts ──► LLM (OpenAI SDK → Groq | Gemini)
```

- **Datos**: server-side con `@duckdb/node-api`, abriendo el archivo en modo
  READ_ONLY por request (no bloquea al pipeline, que es el único escritor). El
  acceso nunca llega al cliente (`server-only`).
- **Gráficos**: `echarts` envuelto en `components/EChart.tsx` (client component;
  ECharts se importa dinámicamente para no romper el SSR).
- **Coaching**: SDK `openai` apuntando a uno de dos proveedores OpenAI-compatibles
  (Groq o Gemini vía Google AI Studio), elegido con el selector de `CoachingPanel`
  y enviado como `provider` en el body de `POST /api/coaching`.

## Setup

```bash
cp .env.example .env.local   # completá LLM_GROQ_API_KEY y/o LLM_GEMINI_API_KEY; DuckDB usa ../warddata.duckdb por default
npm install
npm run dev                  # http://localhost:3000
```

API keys gratis: Groq en https://console.groq.com/keys · Gemini en https://aistudio.google.com/apikey

## Variables de entorno

| Variable                     | Descripción                                                      |
| ---------------------------- | ----------------------------------------------------------------|
| `DUCKDB_PATH`                 | (Opcional) Ruta del archivo DuckDB; default `../warddata.duckdb` |
| `LLM_GROQ_BASE_URL`           | Endpoint OpenAI-compatible de Groq (default `https://api.groq.com/openai/v1`) |
| `LLM_GROQ_API_KEY`            | API key de Groq                                                  |
| `LLM_GROQ_MODEL`              | Modelo (default `openai/gpt-oss-120b`)                           |
| `LLM_GROQ_REASONING_EFFORT`   | Solo modelos de razonamiento: `low`/`medium`/`high` (opcional)   |
| `LLM_GEMINI_BASE_URL`         | Endpoint OpenAI-compatible de Gemini (default `https://generativelanguage.googleapis.com/v1beta/openai/`) |
| `LLM_GEMINI_API_KEY`          | API key de Google AI Studio                                      |
| `LLM_GEMINI_MODEL`            | Modelo (default `gemini-3.5-flash`)                              |
| `LLM_GEMINI_REASONING_EFFORT` | Igual que el de Groq, mapea al thinking budget de Gemini (opcional) |

## Agregar un tercer proveedor (ej. Claude)

Sumá un caso en `getProviderConfig()` (`lib/coach.ts`), agregalo al union type
`Provider` y a la lista `PROVIDERS` en `lib/providers.ts` (usada por el selector
del dashboard), y sus env vars (`LLM_CLAUDE_BASE_URL` / `_API_KEY` / `_MODEL`).

```env
LLM_CLAUDE_BASE_URL=https://api.anthropic.com/v1/
LLM_CLAUDE_API_KEY=sk-ant-...
LLM_CLAUDE_MODEL=claude-sonnet-4-6
```

> Anthropic expone un endpoint OpenAI-compatible. Alternativamente, reemplazá
> `lib/coach.ts` por el SDK `@anthropic-ai/sdk`.
