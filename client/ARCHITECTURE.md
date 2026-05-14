# Agora Conversational AI Web Demo - Architecture

This module owns the browser experience and the web-facing `/api/*` entrypoints. Those entrypoints are declarative rewrites to the Go Gin backend.

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
| Local dev | Next rewrites | `next.config.ts` forwarding to `AGENT_BACKEND_URL` |
| Deployment | Next rewrites | `next.config.ts` forwarding to the deployed Go backend |

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
│       └── utils.ts         # Common utility functions
│
├── ../server/        # Backend service (project root level)
│   ├── src/
│   │   ├── server.py        # Go backend entry, route definitions
│   │   └── agent.py         # Agent class using agora-agent-server-sdk
│   ├── go.mod               # Go dependencies
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
| /api/startAgent | POST | Start Conversational AI Agent |
| /api/stopAgent | POST | Stop Agent |

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

#### POST /api/startAgent
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

#### POST /api/stopAgent
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

### Go-Backed Development and Deployment

```
next.config.ts
└── rewrites()
    ├── /api/get_config → AGENT_BACKEND_URL/get_config
    ├── /api/startAgent → AGENT_BACKEND_URL/startAgent
    └── /api/stopAgent  → AGENT_BACKEND_URL/stopAgent

../server/
├── src/
│   ├── server.py
│   └── agent.py
└── requirements.txt
```

The web client still uses same-origin `/api/*` URLs. Next rewrites them to Go through `AGENT_BACKEND_URL`; no `app/api/**/route.ts` files are required.

## Environment Variables

The web app reads configuration from `client/.env.local` or deployment env vars:

| Variable | Description |
|----------|-------------|
| AGENT_BACKEND_URL | Required Go backend URL for `/api/*` rewrites |
| NEXT_PUBLIC_AGORA_APP_ID | Optional browser override for the Agora App ID; normally supplied by `/api/get_config` |

## Rewrite Proxy

When `AGENT_BACKEND_URL` is set, Next forwards `/api/*` requests to the Go backend:

```typescript
rewrites: () => [
  { source: '/api/startAgent', destination: `${backendUrl}/startAgent` },
]
```

## Event Flow

1. User clicks connect → Call `/api/get_config` to get configuration
2. `AgoraRTCProvider` creates exactly one RTC client via `useRef`, which avoids StrictMode double creation
3. `useAgoraConnection` gates `useJoin` and `useLocalMicrophoneTrack` behind a readiness flag
4. `/api/*` is rewritten by Next to the Go backend
5. Use returned token to login RTM and join RTC
6. Initialize `AgoraVoiceAI` from `agora-agent-client-toolkit`
7. `voiceAI.subscribeMessage(channel)` listens for transcript and agent-state events
8. Call `/api/startAgent` to start the requester-scoped agent session
9. Normalize local transcript UID `0` back to the actual RTC UID before rendering `ConvoTextStream`
10. Renew RTC and RTM tokens through `/api/get_config?channel=...&uid=...` before expiry
11. User clicks stop → Call `/api/stopAgent` → Cleanup resources
