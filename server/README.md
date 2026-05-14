# Agora Agent Service

Gin-based Agora Conversational AI backend using the official Go SDK: `github.com/AgoraIO-Conversational-AI/agent-server-sdk-go`.

## Quick Start

Recommended from the repo root.

Repo setup:

```bash
make setup
```

Agora credentials:

```bash
agora project env write server-go/.env.local --with-secrets
```

Run the app:

```bash
make dev
```

This assumes the Agora CLI is installed and logged in. The command uses the project selected in your Agora CLI context, which is usually your default account project.

`make setup` installs or refreshes both the Go backend dependencies and the frontend workspace dependencies. `make dev` runs the Gin backend and the Next.js frontend together, with the frontend proxying `/api/*` requests to the backend.

If you are not using the Agora CLI, create the env file manually and fill in your project values:

```bash
cp server-go/.env.example server-go/.env.local
```

Backend-only workflow from `server-go/`:

```bash
cp .env.example .env.local
go mod tidy
gofmt -w *.go cmd/fake-server/*.go
go test ./...
go build -o ./bin/agent-quickstart-go .
go run .
```

Backend-only Agora CLI env write from `server-go/`:

```bash
agora project env write .env.local --with-secrets
```

Required env vars:

- `AGORA_APP_ID`
- `AGORA_APP_CERTIFICATE`

Optional:

- `AGENT_GREETING`
- `PORT`

Example:

```bash
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGENT_GREETING=Hi there! I'm Ada, your virtual assistant from Agora. How can I help?
PORT=8000
```

`.env.example` is only the reference template. The recommended setup flow is to let the Agora CLI write the real values into `.env.local`.

If you still need to authenticate with the CLI:

```bash
agora login
```

To select a specific existing project before writing env values, run this from the repo root:

```bash
agora project use <project-id-or-name>
agora project env write server-go/.env.local --with-secrets
```

To create a new project instead of using your default project:

```bash
agora project create my-first-voice-agent --feature rtc --feature convoai
agora project use my-first-voice-agent
agora project env write server-go/.env.local --with-secrets
```

## API Endpoints

- `GET /get_config`
- `POST /v2/startAgent`
- `POST /v2/stopAgent`

`/get_config` returns a one-hour combined RTC + RTM token. The backend uses the same managed provider chain as the web deployment path: Deepgram `nova-3`, OpenAI `gpt-4o-mini`, and MiniMax `speech_2_6_turbo`.

Manual checks:

```bash
curl 'http://127.0.0.1:8000/get_config?uid=1234&channel=manual-check'
curl -X POST 'http://127.0.0.1:8000/v2/startAgent' \
  -H 'Content-Type: application/json' \
  -d '{"channelName":"manual-check","rtcUid":9999,"userUid":1234}'
curl -X POST 'http://127.0.0.1:8000/v2/stopAgent' \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"fake-agent-9999"}'
```

## Verification

```bash
gofmt -w *.go cmd/fake-server/*.go
go test ./...
go build -o ./bin/agent-quickstart-go .
make verify-backend
```

From the repo root, the real local smoke check is:

```bash
make doctor-local
make verify-local-go
```

## Repo Fit

- Local full-stack mode: the Next route handlers proxy here through `AGENT_BACKEND_URL`
- Deployment mode: the Next app can serve the same contract directly without this module
- This backend uses Gin plus the official Go Agent Server SDK, not a hand-written direct REST client
