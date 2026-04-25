# Agent Development Guide

This guide is for coding agents making changes in `agent-quickstart-go`.

## Start Here

- Read [README.md](./README.md) for setup, supported run modes, and verification.
- Use [ARCHITECTURE.md](./ARCHITECTURE.md) for system-level request flow.
- Use module guides only when working inside that module:
  - [web-client/AGENTS.md](./web-client/AGENTS.md)
  - [server-go/AGENTS.md](./server-go/AGENTS.md)

## Current System Shape

- Frontend: Next.js 16, React 19, TypeScript, `agora-rtc-react`, `agora-rtm`, `agora-agent-client-toolkit`, `agora-agent-uikit`
- Local backend: Go + Gin in `server-go`
- Deployed web backend: Next route handlers in `web-client/app/api`
- Auth: Token007 generated from `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`
- Default agent config: managed Deepgram STT, OpenAI LLM, and MiniMax TTS

## Supported Modes

### Local Go-Backed Development

- Run from the repo root with `make dev`
- Root scripts start Gin on `http://localhost:8000` and Next.js on `http://localhost:3000`
- In this mode, the web app still calls `/api/*`, but the Next route handlers proxy to the Go service through `AGENT_BACKEND_URL=http://localhost:8000`

### Single-Target Web Deployment

- Deploy `web-client` as a Next.js app
- `/api/get_config`, `/api/v2/startAgent`, and `/api/v2/stopAgent` run inside the Next app
- Do not assume a separate backend service exists in this mode

## Routing Ownership

- UI and RTC/RTM client lifecycle live in `web-client`
- `/api/*` entrypoints for the web app live in `web-client/app/api`
- Go agent lifecycle logic lives in `server-go`
- For deployability changes, update both the README and architecture docs if the owner of `/api/*` changes

## Key Files

- `README.md`: setup, local vs deploy modes, troubleshooting, verification
- `ARCHITECTURE.md`: top-level environment model
- `web-client/src/components/app.tsx`: conversation UI shell
- `web-client/src/hooks/useAgoraConnection.ts`: RTC, RTM, transcript, and token renewal lifecycle
- `web-client/src/lib/server/agora.ts`: shared server-side token and agent helpers for Next route handlers
- `server-go/main.go`: Gin entrypoints
- `server-go/agent.go`: Agora agent lifecycle wrapper

## Working Rules

- Prefer the smallest change that keeps local mode and deployed mode aligned.
- Do not reintroduce `web-client/proxy.ts`; the current proxy fallback is route-local through `AGENT_BACKEND_URL`.
- Do not assume Zustand or a separate client-side store exists.
- Do not require third-party vendor API keys unless the code actually introduces a non-managed path.
- Keep token expiry and renewal behavior aligned across the Go backend and Next route handlers.

## Standard Commands

From the repo root:

```bash
make setup
make doctor
make doctor-local
make fmt
make test
make dev
make verify
make verify-local
```

Useful narrower checks:

```bash
make build-backend
make verify-web
make verify-local-go
make verify-web-proxy
make verify-backend
```

## Verification Safety

- Safe without live Agora credentials:
  - `make doctor`
  - `make verify-web-api`
  - `make verify-web-proxy`
  - `make verify-local-go`
- Requires local env setup but not a live Agora session:
  - `make doctor-local`
  - `make verify-local`
- Compile and local-runtime coverage only:
  - `make verify-backend`
  - `make verify-local-go`
- Often blocked inside restricted sandboxes because of port binding or Turbopack process spawning:
  - `make dev`
  - `make verify-web-build`
  - `make verify-local`

## Done Criteria

Before finishing a change:

1. Run the narrowest relevant verification command.
2. Run `make fmt` if you changed Go files.
3. If the change affects the Go backend binary or startup path, ensure `make build-backend` passes.
4. If the change affects the deployable web app, ensure `make verify-web` passes.
5. If the change affects local Go-backed development, ensure `make verify-local` or the narrower `make verify-local-go` / `make verify-web-proxy` / `make verify-backend` commands pass as appropriate.
6. Update `README.md` or architecture docs when the developer workflow or request flow changes.
