# Agora Conversational AI Go Quickstart

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Go](https://img.shields.io/badge/go-%3E%3D1.23-00ADD8)](https://go.dev/)
[![pnpm](https://img.shields.io/badge/pnpm-10.x-F69220)](https://pnpm.io/)

Build a production-style voice agent with a Next.js web client and a Go backend (Gin + Agora Agent Server SDK). Includes transcript + state updates over RTM and managed STT/LLM/TTS defaults.

## Prerequisites

- Go 1.23+
- [pnpm](https://pnpm.io/installation)
- [Agora CLI](https://www.npmjs.com/package/agoraio-cli)

## Run It

Install the CLI (skip if already installed), scaffold the Go quickstart, install dependencies, and run.

1. **Install the Agora CLI and sign in** (skip if `agora` is already on your PATH):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/AgoraIO/cli/main/install.sh | sh -s -- --add-to-path
   agora login
   ```

2. **Scaffold and run** (replace `my-go-demo` with your own project name):

   ```bash
   agora init my-go-demo --template go
   cd my-go-demo
   make setup
   make dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) and click **Start conversation**.

If the agent does not join or transcripts do not appear, run **`agora project doctor --deep`**.

### Working from a clone of this repository

Use this path if you already cloned **this** repo:

```bash
git clone https://github.com/AgoraIO-Conversational-AI/agent-quickstart-go.git
cd agent-quickstart-go
agora login
agora project use <your-project>
make setup
agora quickstart env write .
make doctor-local
make dev
```

`make setup` preserves a configured `server/.env`, copies a legacy `server/.env.local` when needed, and prints the credential-writing step when the resulting file lacks real Agora values. Setup and `doctor-local` replace an untouched example file with configured legacy credentials. This supports CLI versions that wrote `.env.local`.

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## Deploy

Deploy the Next.js `client` and the Go `server` as separate targets. The browser still calls stable `/api/*` paths, but this repo is rewrite-only: `client/next.config.ts` forwards those requests to the Go backend through `AGENT_BACKEND_URL`.

Required Go backend env vars:

```bash
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

Required Next.js env var:

```bash
AGENT_BACKEND_URL=https://your-go-backend.example.com
```

Set `AGENT_BACKEND_URL` in the deployed Next.js environment to the public URL of the Go backend. If it is unset, no `/api/*` rewrites are registered.

To export env values from your Agora CLI-bound project:

```bash
agora project use <your-project>
agora quickstart env write .
rg "^(AGORA_APP_ID|AGORA_APP_CERTIFICATE)=" server/.env
```

## Environment variables

Primary backend env file: [`server/.env.example`](server/.env.example).

| Variable | Required | Default | Notes |
| --- | :---: | :---: | --- |
| `AGORA_APP_ID` | ✅ | — | Agora Console -> Project -> App ID |
| `AGORA_APP_CERTIFICATE` | ✅ | — | Agora Console -> Project -> App Certificate (server only) |
| `PORT` |  | `8000` | Gin backend port |
| `AGENT_BACKEND_URL` (local proxy mode) | ✅ (local proxy mode) | `http://localhost:8000` | Used by frontend scripts in local Go-backed mode |

> **Runtime modes** — local mode proxies Next `/api/*` routes to Gin (`AGENT_BACKEND_URL=http://localhost:8000`). Deployment uses the same rewrite contract pointed at a reachable Go backend.

## Commands

```bash
# Dev
make setup
make dev

# Quality
make doctor
make doctor-local
make fmt
make test

# CI / pre-ship
make verify-web
make verify-local
make verify
```

Run `make verify` for web-focused changes, and `make verify-local` when backend/proxy behavior changes.

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./.github/images/system-architecture-dark.svg">
  <img src="./.github/images/system-architecture.svg" alt="System architecture">
</picture>

The browser always calls Next `/api/*` paths. In local and deployed modes those paths are Next rewrites to Gin through `AGENT_BACKEND_URL`; both modes keep the same browser contract.

## What You Get

- `client/` Next.js client with voice conversation UI
- `server/` Gin backend using official Agora Agent Server SDK for Go
- stable `/api/get_config`, `/api/startAgent`, `/api/stopAgent` browser contract
- combined RTC + RTM token generation from `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE`

## How It Works

1. Browser requests config from `/api/get_config`.
2. Backend returns app ID, channel, user UID, agent UID, and token.
3. Browser joins RTC/RTM and streams audio.
4. Browser calls `/api/startAgent`; backend starts the cloud agent session.
5. Browser receives transcript/state updates; `/api/stopAgent` ends the session.

## Repo Map

- `client/` — Next.js 16 + React 19 + TypeScript frontend
- `server/` — Gin backend + Agora Agent Server SDK integration
- `ARCHITECTURE.md` — system flow and runtime modes
- `AGENTS.md` — contributor agent instructions

## Troubleshooting

- **`make doctor-local` fails:** confirm Go 1.23+ and non-empty `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` in `server/.env`.
- **Credentials missing:** run `agora quickstart env write .`.
- **Frontend cannot reach backend:** confirm the Go service is running and the frontend has `AGENT_BACKEND_URL` set to that service URL.
- **Agent does not join channel:** verify the selected Agora project has Conversational AI managed provider support enabled.
- **Unsure who owns `/api/*`:** Next owns the browser-facing paths as rewrites; Gin owns the backend handlers.

## More Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [AGENTS.md](./AGENTS.md)
- [docs/ai/L1/02_architecture.md](./docs/ai/L1/02_architecture.md) — full-stack topology and lifecycle
- [docs/ai/L1/03_code_map.md](./docs/ai/L1/03_code_map.md) — curated `client/` + `server/` file map

## License

Released under the [MIT License](./LICENSE).
