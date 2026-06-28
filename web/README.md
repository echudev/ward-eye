# ward-eye · web

Dashboard Next.js que consume los marts de dbt (`lol_marts.*`) desde Supabase,
los grafica con Apache ECharts y genera coaching automático vía un endpoint
LLM OpenAI-compatible (Groq por defecto, swappeable a Claude/OpenAI por env).

## Arquitectura

```
app/page.tsx ──(server)──► lib/queries.ts ──► lib/db.ts ──► Postgres (lol_marts)
     │                                                          (pooler Supabase)
     ├─ components/Kpis, charts/* (ECharts, client)
     └─ components/CoachingPanel (client)
              └─ POST /api/coaching ──► lib/coach.ts ──► LLM (OpenAI SDK → Groq)
```

- **Datos**: server-side con el driver `postgres`. Las credenciales nunca llegan
  al cliente (`server-only`).
- **Gráficos**: `echarts` envuelto en `components/EChart.tsx` (client component;
  ECharts se importa dinámicamente para no romper el SSR).
- **Coaching**: SDK `openai` apuntando a `LLM_BASE_URL`. Cambiar de proveedor es
  solo cambiar variables de entorno.

## Setup

```bash
cp .env.example .env.local   # completá DB_PASSWORD y LLM_API_KEY (Groq)
npm install
npm run dev                  # http://localhost:3000
```

Obtené una API key gratis en https://console.groq.com/keys

## Variables de entorno

| Variable       | Descripción                                            |
| -------------- | ------------------------------------------------------ |
| `DB_HOST`      | Host del pooler de Supabase                            |
| `DB_PORT`      | 5432 (session) o 6543 (transaction)                    |
| `DB_NAME`      | `postgres`                                             |
| `DB_USER`      | `postgres.<project_ref>`                               |
| `DB_PASSWORD`  | Password de la DB                                      |
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
