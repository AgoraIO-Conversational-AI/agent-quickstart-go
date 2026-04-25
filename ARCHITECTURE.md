# Agora Conversational AI Demo — Architecture

The UI stays the same across environments. What changes is who owns `/api/*`.

## Local Go-Backed Development

```text
Browser
  ↓
Next.js app on :3000
  ↓
/api/* route handlers proxy through AGENT_BACKEND_URL
  ↓
Gin service on :8000
  ↓
Agora Cloud Services
```

- `web-client` owns the browser UI and the web-facing routes
- `server-go` owns token generation and agent lifecycle for local development
- `make dev` starts both services together

## Single-Target Web Deployment

```text
Browser
  ↓
Next.js app
  ↓
/api/* route handlers run in-process
  ↓
Agora Cloud Services
```

- `web-client` handles both UI and API
- `server-go` is optional unless you want an external backend

## Shared Flow

1. `GET /api/get_config` returns app ID, token, channel, user UID, and agent UID.
2. `POST /api/v2/startAgent` creates a managed agent session scoped to the requesting user.
3. The agent joins RTC, publishes audio, and emits transcript events over RTM.
4. `POST /api/v2/stopAgent` stops the in-memory session or falls back to stateless stop by agent ID.

## API Contract

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/get_config` | GET | Generate RTC + RTM config |
| `/v2/startAgent` | POST | Start an agent session |
| `/v2/stopAgent` | POST | Stop an agent session |

The frontend always calls `/api/*`. In local mode those handlers proxy to `AGENT_BACKEND_URL`; in deployment they execute directly in the Next app.

## Authentication

The Go backend uses app credentials mode with the official Agora Agent Server SDK for Go. Combined RTC + RTM tokens are generated from `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE`, and REST auth is handled by the SDK.

## References

- [web-client/ARCHITECTURE.md](./web-client/ARCHITECTURE.md)
- [server-go/ARCHITECTURE.md](./server-go/ARCHITECTURE.md)
- [README.md](./README.md)
