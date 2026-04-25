# Agora Agent Service — Backend Architecture

## Overview

`server-go` is the local backend path for token generation and Agora agent lifecycle management.

Responsibilities:

- Generate RTC + RTM tokens for the web client
- Start and stop managed agent sessions with the Go SDK
- Keep the local `/get_config`, `/v2/startAgent`, and `/v2/stopAgent` contract aligned with the Next route handlers

## Stack

| Component | Technology |
|-----------|------------|
| Framework | Gin |
| Language | Go |
| SDK | `github.com/AgoraIO-Conversational-AI/agent-server-sdk-go` |
| Config | `godotenv` |

## File Layout

```text
server-go/
├── agent.go        # Agent service, token generation, session map
├── main.go         # Gin router and HTTP handlers
├── go.mod
└── .env.example
```

## Request Flow

```text
Frontend request
  ↓
Gin handler
  ↓
agentService
  ↓
Official Agora Agent Server SDK for Go
  ↓
Agora Conversational AI APIs
```

## Runtime Model

- `agentService` holds one SDK client and an in-memory map of started sessions.
- `GET /get_config` creates a one-hour combined RTC + RTM token.
- `POST /v2/startAgent` builds an Ada-configured agent and starts a session for one requesting user.
- `POST /v2/stopAgent` stops the stored session when available, then falls back to stateless `StopAgent`.

## Default Managed Pipeline

- STT: Deepgram `nova-3`
- LLM: OpenAI `gpt-4o-mini`
- TTS: MiniMax `speech_2_6_turbo`

## Frontend Integration

In local mode, Next route handlers proxy here through `AGENT_BACKEND_URL=http://localhost:8000`:

```text
/api/get_config    -> /get_config
/api/v2/startAgent -> /v2/startAgent
/api/v2/stopAgent  -> /v2/stopAgent
```
