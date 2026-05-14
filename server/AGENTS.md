# Go Backend Agent Guide

Use this guide when changing files under `server-go/`.

## Current Role

This module is the local Gin backend for the quickstart. It remains the authoritative local backend when developing the full stack on one machine.

The deployed web app can also serve `/api/*` directly from Next route handlers, so do not assume Go owns production traffic in every environment.

## Current Stack

- Go
- Gin
- `github.com/AgoraIO-Conversational-AI/agent-server-sdk-go`
- `godotenv`

## Current Implementation Model

- `main.go` exposes `/get_config`, `/v2/startAgent`, and `/v2/stopAgent`
- `agent.go` wraps the official Go Agent Server SDK
- agent sessions are scoped to the requesting user with `remote_uids=[user_uid]`
- stop is idempotent through a session stop first, then `client.stop_agent(...)` fallback
- token expiry is 1 hour
- default providers are the managed Deepgram STT, OpenAI LLM, and MiniMax TTS path used by the current quickstart

## Environment

Setup from the repo root:

```bash
cp server-go/.env.example server-go/.env.local
```

Required values:

```bash
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

Optional values:

```bash
PORT=8000
AGENT_GREETING=Custom greeting
```

Do not assume separate ASR, LLM, or TTS vendor secrets are required unless the code introduces a custom non-managed provider path.

## Important Files

- `main.go`: Gin routes and config generation
- `agent.go`: agent lifecycle and provider configuration
- `.env.example`: local env template
- `README.md`: backend-specific setup and API examples

## Commands

From the repo root:

```bash
make backend
make doctor-local
make verify-local-go
make verify-backend
```

From `server-go/` directly:

```bash
go mod tidy
go run .
```

## Verification Safety

- `make verify-backend` is safe without live Agora credentials.
- `make verify-local-go` is safe without live Agora credentials but needs localhost port binding.
- Full live agent startup still depends on valid Agora credentials and project readiness.

## Working Rules

- Keep the Gin handlers thin and keep Agora logic in `agent.go`.
- Keep token generation behavior aligned with the Next route handlers.
- If you change the request or response contract, update the web client and root README in the same change.
- If you change agent defaults, update both backend implementations or document the intended divergence clearly.
