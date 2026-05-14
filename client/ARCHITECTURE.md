# Agora Conversational AI Web Demo - Architecture

This module owns the browser experience and the web-facing `/api/*` entrypoints.

## Tech Stack

### Frontend

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 + React 19 |
| Language | TypeScript |
| Build Tool | Turbopack |
| Styling | Tailwind CSS |
| RTC SDK | agora-rtc-react |
| RTM SDK | agora-rtm |
| ConvoAI Toolkit | agora-agent-client-toolkit + agora-agent-uikit |

### API Ownership

| Environment | Owner of `/api/*` | Implementation |
|-------------|-------------------|----------------|
| Local dev | Next route handlers with proxy fallback | `app/api/**/route.ts` forwarding to `AGENT_BACKEND_URL` |
| Deployment | Next route handlers in-process | `app/api/**/route.ts` using `src/lib/server/agora.ts` |

## Project Structure

```
.
├── app/                     # Next.js App Router
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Home page (loads AgoraProvider + App)
├── src/                     # Frontend source
│   ├── components/          # UI components
│   │   └── app.tsx          # Landing screen + live conversation UI
│   ├── hooks/               # React hooks
│   │   └── useAgoraConnection.ts # RTC/RTM/VoiceAI connection hook
│   ├── services/            # Service layer
│   │   └── api.ts           # Backend API calls (get_config, startAgent, stopAgent)
│   └── lib/                 # Utility libraries
│       ├── conversation.ts  # Transcript + visualizer helpers
│       ├── server/agora.ts  # Shared server-side Agora helpers for route handlers
│       └── utils.ts         # Common utility functions
│
├── app/api/                 # Route handlers for quick Vercel deployment
├── ../server-go/            # Optional local backend (project root level)
│   ├── main.go              # Gin entry and routes
│   ├── agent.go             # Go SDK wrapper and session lifecycle
│   ├── go.mod               # Go module definition
│   └── .env.local           # Backend environment variables
│
├── next.config.ts           # Next.js configuration
└── package.json             # Frontend dependencies + scripts
```

## Core Modules

### 1. App (Landing + Conversation)

- Landing-page-to-conversation transition aligned with the Next.js quickstart
- Uses `AgentVisualizer`, `ConvoTextStream`, and `MicButtonWithVisualizer` from `agora-agent-uikit`
- Keeps the end-call and mic controls in the same docked conversation layout as the reference sample

## Data Flow

```
User Action → useAgoraConnection hook → Agora SDK (agora-rtc-react)
                   ↓
 AgoraVoiceAI Events (agora-agent-client-toolkit)
                   ↓
 UIKit transcript + visualizer components
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/get_config | GET | Generate connection config (token, channel, UIDs) |
| /api/v2/startAgent | POST | Start Conversational AI Agent |
| /api/v2/stopAgent | POST | Stop Agent |

### Request/Response Examples

#### GET /api/get_config
```json
// Response
{
  "code": 0,
  "msg": "success",
  "data": {
    "app_id": "your_app_id",
    "token": "007eJxT...",
    "uid": "123456",
    "channel_name": "channel_1234567890",
    "agent_uid": "12345678"
  }
}
```

#### POST /api/v2/startAgent
```json
// Request
{
  "channelName": "test-channel",
  "rtcUid": 12345678,
  "userUid": 123456
}

// Response
{
  "code": 0,
  "msg": "success",
  "data": {
    "agent_id": "abc-123-def",
    "channel_name": "test-channel",
    "status": "started"
  }
}
```

#### POST /api/v2/stopAgent
```json
// Request
{
  "agentId": "abc-123-def"
}

// Response
{
  "code": 0,
  "msg": "success"
}
```

## Environment Modes

### Local Go-Backed Development

```
app/api/
├── get_config/route.ts
└── v2/
    ├── startAgent/route.ts
    └── stopAgent/route.ts

Optional local backend:
../server-go/
├── main.go
├── agent.go
└── go.mod
```

In this mode, the web client still receives all browser requests. The route handlers proxy to the local Go service through `AGENT_BACKEND_URL`.

### Single-Target Web Deployment

The same `app/api/**/route.ts` files run directly inside the deployed Next app. No separate backend service is required.

## Environment Variables

The web client route handlers can read configuration from `web-client/.env.local` or Vercel project env vars:

| Variable | Description |
|----------|-------------|
| AGORA_APP_ID | Agora App ID |
| AGORA_APP_CERTIFICATE | Agora App Certificate |
| AGENT_GREETING | Optional custom greeting for the Ada persona |
| AGENT_BACKEND_URL | Optional local backend URL for proxy mode |

## Local Proxy Mode

When `AGENT_BACKEND_URL` is set, the Next route handlers forward `/api/*` requests to the local backend:

```typescript
const proxiedResponse = await proxyToLocalBackend('v2/startAgent', {
  method: 'POST',
  body: JSON.stringify({ channelName, rtcUid, userUid }),
})
```

## Event Flow

1. User clicks connect → Call `/api/get_config` to get configuration
2. `AgoraRTCProvider` creates exactly one RTC client via `useRef`, which avoids StrictMode double creation
3. `useAgoraConnection` gates `useJoin` and `useLocalMicrophoneTrack` behind a readiness flag
4. `/api/*` is handled in-process in deployed mode, or proxied to the local backend when `AGENT_BACKEND_URL` is set
5. Use returned token to login RTM and join RTC
6. Initialize `AgoraVoiceAI` from `agora-agent-client-toolkit`
7. `voiceAI.subscribeMessage(channel)` listens for transcript and agent-state events
8. Call `/api/v2/startAgent` to start the requester-scoped agent session
9. Normalize local transcript UID `0` back to the actual RTC UID before rendering `ConvoTextStream`
10. Renew RTC and RTM tokens through `/api/get_config?channel=...&uid=...` before expiry
11. User clicks stop → Call `/api/v2/stopAgent` → Cleanup resources
