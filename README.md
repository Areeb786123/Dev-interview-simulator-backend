# Dev Interview Simulator — Backend

Express + TypeScript API for AI system-design interviews (Groq + optional Postgres).

## Features

- `GET /health`
- `POST /api/v1/evaluate` — stateless evaluate (structure gate → cache → LLM)
- Interview APIs: start / evaluate / revise / answer / abandon / get / history  
  States: `IN_PROGRESS → NEEDS_REVISION → PASSED` · `FAILED` (caps) · `ABANDONED`
- Pass threshold **≥ 8** enforced server-side
- Request-hash evaluation cache (in-memory; Redis only if multi-instance needed)
- Official `groq-sdk` when `GROQ_API_KEY` set; mock otherwise
- Timeouts, limited retries, provider usage when available
- Rate limits + attempt caps + estimated cost tracking
- Technology catalog embedded in rubric prompts

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Postgres (optional):

```bash
docker compose up -d
# DATABASE_URL=postgres://postgres:postgres@localhost:5432/devsim
```

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Default `4000` |
| `GROQ_API_KEY` | Enables live Groq |
| `GROQ_MODEL` | Default `openai/gpt-oss-20b` (~$0.075/M in, $0.30/M out) |
| `GROQ_MAX_COMPLETION_TOKENS` | Default `1600` |
| `GROQ_TIMEOUT_MS` | Default `25000` |
| `GROQ_MAX_RETRIES` | Default `2` |
| `DATABASE_URL` | Optional Postgres |
| `RATE_LIMIT_*` | `/api` rate limit |
| `MAX_EVALUATE_ATTEMPTS` / `MAX_ANSWER_ATTEMPTS` | Caps → `FAILED` |

## Scoring rubric (summary)

| Score | Meaning |
|-------|---------|
| 1–3 | Major errors / missing essentials |
| 4–5 | Partial with important gaps |
| 6–7 | Reasonable but weak spots remain |
| 8 | Acceptable for this challenge |
| 9–10 | Strong / excellent |

## Tests

```bash
npm test
npm run build
# optional live:
GROQ_LIVE_TEST=1 GROQ_API_KEY=gsk_... npm test -- src/evaluation/groq/groq.integration.test.ts
```

## Why not Mongo/Redis yet

Postgres is enough for interview rows + JSONB history. Redis would help shared cache/rate limits across many API instances. Mongo only if a document-native product surface appears that JSONB cannot cover simply.
