# Agora Conversational AI Web Demo

Real-time voice conversation with an Agora agent, using a Next.js web client and a Go backend built with Gin plus the official Agora Agent Server SDK for Go.

## System Diagram

```text
Local mode
Browser
  -> Next.js app on :3000
  -> /api/* route handlers
  -> Gin backend on :8000
  -> Agora Cloud

Deployed mode
Browser
  -> Next.js app
  -> /api/* route handlers in-process
  -> Agora Cloud
```

## Prerequisites

- [pnpm](https://pnpm.io/installation)
- Go 1.23+
- [Agora CLI](https://www.npmjs.com/package/agoraio-cli)
- [Agora Account](https://console.agora.io/) with App ID and App Certificate
- Agora project with Conversational AI managed provider support enabled

## Quick Start

### Local Go-Backed Development

```bash
make setup
agora login
agora project create my-first-voice-agent --feature rtc --feature convoai
agora project use my-first-voice-agent
agora project env write server-go/.env.local --with-secrets
make doctor-local
make fmt
make test
make dev
```

`server-go/.env.example` remains the reference for the variables this demo uses. The recommended path is to let the Agora CLI write the real values into `server-go/.env.local`.

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

In local development, the browser still talks to Next `/api/*`. Those route handlers proxy to the Gin backend through `AGENT_BACKEND_URL=http://localhost:8000`.

## Why Two Runtime Modes

- Local Go-backed mode exists so backend and web changes can be developed independently while preserving the same browser-facing API contract.
- Single-target deployment mode exists so the web app can be deployed as one unit without requiring a separately hosted backend.
- Both modes keep `/api/get_config`, `/api/v2/startAgent`, and `/api/v2/stopAgent` stable, which reduces drift for both humans and automated contributors.

### Single-Target Web Deployment

Deploy `web-client` as a Next.js app. In that mode, the same route handlers serve `/api/get_config`, `/api/v2/startAgent`, and `/api/v2/stopAgent` in-process.

Deployment env vars:

```bash
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGENT_GREETING=optional_custom_greeting
```

Leave `AGENT_BACKEND_URL` unset in deployment unless you intentionally want the web app to proxy to an external backend.

## Configuration

Recommended:

```bash
agora project env write server-go/.env.local --with-secrets
```

Reference template:

```bash
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGENT_GREETING=Hi there! I'm Ada, your virtual assistant from Agora. How can I help?
PORT=8000
```

The backend uses app credentials mode with the official Go SDK and generates combined RTC + RTM tokens from `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`. Those names match the Agora CLI export contract. The default managed pipeline matches the current quickstart contract: Deepgram `nova-3`, OpenAI `gpt-4o-mini`, and MiniMax `speech_2_6_turbo`.

## Commands

```bash
make setup
make doctor
make doctor-local
make fmt
make test
make dev
make backend
make frontend
make build
make build-backend
make build-web
make test
make test-backend
make verify
make verify-local
make verify-local-go
make verify-backend
make verify-web
make verify-web-api
make verify-web-proxy
make verify-web-build
```

Go-native workflow comes first in this repo:

- `make fmt` formats backend Go code with `gofmt`
- `make test` runs backend tests
- `make build` builds both the Go backend and the Next.js frontend

`pnpm` is the standard frontend package manager for this repo. Root `package.json` scripts remain available as compatibility aliases for workspace automation, but `make` is the default interface.

## Setup Notes

- `make setup` is the primary first-run command for this repo.
- It prepares `server-go/.env.local`, resolves Go dependencies, and installs frontend workspace dependencies when needed.
- After `make setup`, write real Agora values with `agora project env write server-go/.env.local --with-secrets`.
- After `make setup`, the expected next step is `make doctor-local`.

## Project Structure

```text
.
├── web-client/      # Next.js 16 + React 19 + TypeScript client
├── server-go/       # Gin + Agora Agent Server SDK for Go backend
├── ARCHITECTURE.md
└── AGENTS.md
```

## Verification

Run:

```bash
make verify-backend
make verify-local
```

What each command proves:

- `make doctor` checks shared repo prerequisites: `pnpm` is available and frontend dependencies are installed.
- `make doctor-local` checks local Go-backed prerequisites: Go 1.23+, `server-go/.env.local`, `AGORA_APP_ID`, and `AGORA_APP_CERTIFICATE`.
- `make fmt` runs `gofmt` on the Go backend sources.
- `make test` runs the backend Go test suite.
- `make build-backend` compiles the Gin backend into `server-go/bin/agent-quickstart-go`.
- `make build-web` runs the production web build.
- `make build` runs both backend and frontend builds.
- `make verify-backend` runs Go backend tests for config generation, validation helpers, and stop fallback behavior.
- `make verify-web-api` validates the in-process Next API contract.
- `make verify-web-proxy` validates route-local proxy behavior against a stub backend without needing live Agora credentials.
- `make verify-local-go` boots a real local Go server and smoke-tests the real Next-to-Go request path.
- `make verify-web-build` runs the production web build.
- `make verify-local` combines the local prerequisite checks, backend tests, real local Go smoke test, proxy contract check, and production web build.
- `make verify` runs the web-focused verification suite.

Verification safety:

- Safe without live Agora credentials:
  - `make doctor`
  - `make verify-web-api`
  - `make verify-web-proxy`
  - `make verify-local-go`
- Requires local env setup but not a live Agora session:
  - `make doctor-local`
  - `make verify-local`
- Compile and local runtime only:
  - `make verify-backend`
  - `make verify-local-go`
- May require running outside a restricted sandbox because of local port binding or Turbopack process spawning:
  - `make dev`
  - `make verify-web-build`
  - `make verify-local`

## Troubleshooting

| Problem | Check |
|---------|-------|
| `make doctor-local` fails | Confirm Go 1.23+ is installed and `server-go/.env.local` contains non-empty `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`. |
| Agora credentials not written yet | Run `agora project use my-first-voice-agent` and `agora project env write server-go/.env.local --with-secrets`. |
| Backend returns `generate token: check appId or appCertificate` | Your local env file still contains placeholder credentials or invalid values. |
| Frontend cannot reach backend in local mode | Confirm `make dev` is running and the frontend is using `AGENT_BACKEND_URL=http://localhost:8000`. |
| `make verify-web-build` fails inside a restricted sandbox | Turbopack may be blocked from spawning helper processes or binding local ports; rerun outside the sandbox. |
| Agent does not join the channel | Confirm the Agora project has Conversational AI managed-provider support enabled and that the credentials belong to the correct project. |
| Unsure which service owns `/api/*` | Local mode: Next route handlers proxy to Gin. Deployment: Next route handlers run in-process unless `AGENT_BACKEND_URL` is set. |

Manual backend checks:

```bash
curl 'http://127.0.0.1:8000/get_config?uid=1234&channel=manual-check'
curl -X POST 'http://127.0.0.1:8000/v2/startAgent' \
  -H 'Content-Type: application/json' \
  -d '{"channelName":"manual-check","rtcUid":9999,"userUid":1234}'
```

## Deployment

Normal deployment uses `web-client` only. The Next.js route handlers run in-process and serve:

- `/api/get_config`
- `/api/v2/startAgent`
- `/api/v2/stopAgent`

Deployment env vars:

```bash
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGENT_GREETING=optional_custom_greeting
```

Environment ownership:

- Local Go backend mode:
  - `server-go/.env.local`
  - `AGENT_BACKEND_URL=http://localhost:8000` is set by the root frontend command
- Deployed Next.js mode:
  - env vars belong to the deployed Next.js target
  - leave `AGENT_BACKEND_URL` unset unless you intentionally want to proxy to an external backend

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [web-client/](./web-client/)
- [server-go/](./server-go/)

## License

See [LICENSE](./LICENSE).
