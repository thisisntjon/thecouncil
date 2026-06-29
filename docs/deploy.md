# Deploying The Council (reproducible path)

Deployment to a public endpoint is **not required** for judging. We deliberately **do not** host the live
app publicly: it runs on private provider keys, and the competition's "public project link" must be
no-login / no-paywall — so a public endpoint on our keys would be an uncapped abuse/cost risk. Instead, the
live agent is shown in the **video**, and this **repo + the steps below** are the project link.

This document is the reproducible deploy path for anyone who wants to host their own instance with their own
keys.

## What you deploy

Three small Node services + a static front-end:

| Service | Dir | Port | Start |
|---|---|---|---|
| API (orchestrates the 4 models) | `server/` | 3001 | `npm start` |
| Cross-vendor verifier | `shadow-council/` | 3002 | `npm start` |
| React UI (build → static) | `client/` | 5173 (dev) | `npm run build` → serve `client/dist` |

## Environment

Copy `.env.example` → `.env` (never commit it) and set the provider keys you have:

```
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_API_KEY=...
XAI_API_KEY=...            # (GROK_API_KEY is accepted as an alias)
# Optional hardening for a shared instance:
COUNCIL_API_TOKEN=...      # require a bearer token on the API
SHADOW_API_TOKEN=...       # require a bearer token on the verifier
```

> Grok runs through the OpenAI SDK pointed at `https://api.x.ai/v1`, so the three SDK packages
> (`@anthropic-ai/sdk`, `openai`, `@google/generative-ai`) cover all four vendors.

## Local / single-box

```bash
npm --prefix server install && npm --prefix shadow-council install && npm --prefix client install
npm --prefix server start            # :3001
npm --prefix shadow-council start    # :3002
npm --prefix client run build && npx --prefix client vite preview --port 5173
# open http://localhost:5173
```

Or on Windows just: `launch.bat live` (starts all three, reuses any already running).

## Container (Cloud Run / Render / Fly)

Each Node service deploys as a standard container — example for the API:

```dockerfile
# server/Dockerfile
FROM node:20-slim
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
ENV PORT=3001
CMD ["npm","start"]
```

Deploy the same way for `shadow-council/` (PORT 3002). Build the client (`npm --prefix client run build`)
and host `client/dist` on any static host / CDN, pointing it at the deployed API + verifier URLs.

**Reproduce on Cloud Run** (sketch):

```bash
gcloud run deploy council-api      --source server          --set-env-vars "$(cat .env | xargs)" --port 3001
gcloud run deploy council-verifier --source shadow-council  --set-env-vars "$(cat .env | xargs)" --port 3002
# build + deploy client/dist to Firebase Hosting / Cloud Storage + CDN
```

## If you do host it publicly

Set `COUNCIL_API_TOKEN` + `SHADOW_API_TOKEN`, put a **hard daily spend cap** on each provider account, and
rate-limit the API — a no-login endpoint on live keys is otherwise an open spend surface.

## No-key reproducibility (CI)

The deterministic offline engine needs none of the above: `npm run demo:fixture` and `npm test` run the full
pipeline with no keys/network — that's what CI and a keyless reviewer use.
