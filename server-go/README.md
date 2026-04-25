# Agora Agent Service

Gin-based Agora Conversational AI backend using the official Go SDK: `github.com/AgoraIO-Conversational-AI/agent-server-sdk-go`.

## Quick Start

From `server-go/`:

```bash
cp .env.example .env.local
agora project env write .env.local --with-secrets
go mod tidy
gofmt -w *.go cmd/fake-server/*.go
go test ./...
go build -o ./bin/agent-quickstart-go .
go run .
```

Recommended from the repo root:

```bash
agora login
agora project create my-first-voice-agent --feature rtc --feature convoai
agora project use my-first-voice-agent
agora project env write server-go/.env.local --with-secrets
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
