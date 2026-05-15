# Managed Agent Config

> **When to Read This:** Load this document when you are changing the agent's prompt, voice, VAD behavior, model selection, session options, or wiring a bring-your-own-key (BYOK) provider on the Go side.

## Where It Lives

All managed agent configuration is in `server/agent.go`. The browser sends `{ channelName, rtcUid, userUid }` to `POST /startAgent`, which calls `agentService.start(...)`. That function builds an SDK-driven agent and starts a session.

## The Agent Builder Chain

`agentkit.NewAgent` takes functional options — not method chaining. `AdvancedFeatures` and `Parameters` (including `DataChannel`, `EnableErrorMessage`, `EnableRtm`, `EnableTools`) are options on the agent, not on the session.

```go
agent := agentkit.NewAgent(
    agentkit.WithName(fmt.Sprintf("agent_%s_%d_%d", channelName, agentUID, time.Now().Unix())),
    agentkit.WithInstructions(adaPrompt),
    agentkit.WithGreeting(s.greeting),
    agentkit.WithFailureMessage("Please wait a moment."),
    agentkit.WithMaxHistory(50),
    agentkit.WithTurnDetectionConfig(&agentkit.TurnDetectionConfig{
        Config: &agentkit.TurnDetectionNestedConfig{
            SpeechThreshold: float64Ptr(0.5),
            StartOfSpeech: &agentkit.StartOfSpeechConfig{
                Mode: agentkit.StartOfSpeechMode("vad"),
                VadConfig: &agentkit.StartOfSpeechVadConfig{
                    InterruptDurationMs: intPtr(160),
                    PrefixPaddingMs:     intPtr(300),
                },
            },
            EndOfSpeech: &agentkit.EndOfSpeechConfig{
                Mode: &endOfSpeechMode,   // agentkit.EndOfSpeechMode("vad")
                VadConfig: &agentkit.EndOfSpeechVadConfig{
                    SilenceDurationMs: intPtr(480),
                },
            },
        },
    }),
    agentkit.WithAdvancedFeatures(&agentkit.AdvancedFeatures{
        EnableRtm:   &enableRTM,    // true
        EnableTools: &enableTools,  // true
    }),
    agentkit.WithParameters(&agentkit.SessionParams{
        DataChannel:        &dataChannel,        // "rtm"
        EnableErrorMessage: &enableErrorMessage, // true
    }),
).
    WithLlm(vendors.NewOpenAI(vendors.OpenAIOptions{
        Model:           "gpt-4o-mini",
        GreetingMessage: s.greeting,
        FailureMessage:  "Please wait a moment.",
        MaxHistory:      intPtr(15),
        MaxTokens:       intPtr(1024),
        Temperature:     float64Ptr(0.7),
        TopP:            float64Ptr(0.95),
    })).
    WithStt(vendors.NewDeepgramSTT(vendors.DeepgramSTTOptions{
        Model:    "nova-3",
        Language: "en",
    })).
    WithTts(vendors.NewMiniMaxTTS(vendors.MiniMaxTTSOptions{
        Model:   "speech_2_6_turbo",
        VoiceID: "English_captivating_female1",
    }))
```

The exact field names match `agora-agent-server-sdk-go`. If you bump the SDK, re-check field names — some options moved between minor versions.

## Session Options

`CreateSession` takes the `AgoraClient` as its first argument, then the session options struct. `session.Start(ctx)` is called separately and returns the `agentID`.

```go
session := agent.CreateSession(s.sessionClient, agentkit.CreateSessionOptions{
    Channel:         channelName,
    AgentUID:        strconv.Itoa(agentUID),
    RemoteUIDs:      []string{strconv.Itoa(userUID)},
    EnableStringUID: &enableStringUID,  // false
    IdleTimeout:     &idleTimeout,      // 30
    ExpiresIn:       expiresIn,
})

agentID, err := session.Start(ctx)
```

| Option            | Effect                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| `Channel`         | The RTC channel the agent joins.                                            |
| `AgentUID`        | UID the agent occupies; must match `AGENT_UID` in the web client.           |
| `RemoteUIDs`      | Restricts the agent to the requester's UID; prevents cross-channel sniping. |
| `EnableStringUID` | `false` keeps UIDs numeric for both RTC and RTM.                            |
| `IdleTimeout`     | Seconds of silence before the session ends.                                 |
| `ExpiresIn`       | Hard ceiling on session length, mirrors the 1-hour token.                   |

`DataChannel`, `EnableRtm`, `EnableTools`, and `EnableErrorMessage` are **not** session options — they live on the agent via `agentkit.WithAdvancedFeatures` and `agentkit.WithParameters`.

## Editing Each Surface

### Change the prompt

Edit the `adaPrompt` string constant at the top of `agent.go`. Keep it concise — long prompts amplify LLM latency.

### Change the greeting

Set `AGENT_GREETING` in `server/.env.local`, or edit the fallback default in `newAgentService`.

### Change VAD

Edit the `TurnDetectionConfig` passed to `agentkit.WithTurnDetectionConfig`. The struct uses a `Config` wrapper field with nested `StartOfSpeech` and `EndOfSpeech` sub-structs — do **not** use a flat struct shape. Tuning notes:

- `SpeechThreshold` (on `TurnDetectionNestedConfig`) — VAD activation sensitivity (0.0–1.0). Lower values trigger on quieter audio.
- `InterruptDurationMs` (on `StartOfSpeechVadConfig`) — minimum user speech before the agent yields. Lower = more responsive interruptions.
- `PrefixPaddingMs` (on `StartOfSpeechVadConfig`) — audio captured before VAD triggers; raise this if early phonemes are clipped.
- `SilenceDurationMs` (on `EndOfSpeechVadConfig`) — silence after speech before VAD ends the turn. Raise this for slow speakers.

### Swap STT / LLM / TTS

Replace the corresponding `vendors.New*` constructor. The SDK exposes alternatives — check `agora-agent-server-sdk-go/vendors`. For a BYOK provider, pass `APIKey: os.Getenv("PROVIDER_API_KEY")` to the constructor and document the env var in `server/.env.example`.

### Session-Level Tuning

- Lower `IdleTimeout` (e.g. 15) for short demos. It is a pointer field (`&idleTimeout`).
- `DataChannel` is set via `agentkit.WithParameters(&agentkit.SessionParams{DataChannel: ...})` on the agent, not in `CreateSessionOptions`. Switch to `"sct"` only if you are not relying on RTM transcripts.
- `enable_metrics` is not exposed in the current Go SDK's `SessionParams` — metrics arrive automatically when `DataChannel` is `"rtm"` and the managed service supports them.

## Response Contract

`startAgent` returns:

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "agent_id": "string",
    "channel_name": "string",
    "status": "started"
  }
}
```

The client stores `agent_id` in `agoraData` and later passes it to `/api/stopAgent`.

Stop is idempotent: `agentService.stop` tries `session.Stop(ctx)` on the in-memory session first (mutex-protected), then falls back to `stopClient.StopAgent(ctx, agentID)`. A 404 from `StopAgent` resolves without error.

## Verification

`server/main_test.go` exercises:

- `newAgentService` env requirement (returns error when `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` are missing).
- `generateConfig` UID generation behavior.
- `start` / `stop` validation behavior.

After editing `agent.go`, run `make fmt && make verify-backend`.

## Failure Modes

| Symptom                                              | Cause                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `500 Agora credentials are not set`                  | Missing `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE` in `server/.env.local`. |
| Agent joins but never speaks                         | TTS vendor key missing or wrong `VoiceID`.                              |
| Agent state stuck in `IDLE`                          | `EnableRtm` is `false` in `WithAdvancedFeatures`, or RTM subscribed before login. |
| Metrics events missing                               | `enable_metrics` is not in Go `SessionParams`; metrics flow automatically when `DataChannel` is `"rtm"`. |
| Build fails: `unknown field`                         | SDK version mismatch; run `go mod tidy` and check `server/go.mod`.      |

## Parity With the Python Quickstart

The sibling [`agent-quickstart-python`](https://github.com/AgoraIO-Conversational-AI/agent-quickstart-python) repo builds the same managed pipeline in `server/src/agent.py`. When you change a managed agent field here:

- Mirror the change in the Python repo's `agent.py` if the field is part of the family-wide product surface (model, voice, VAD, session options, advanced features, parameters).
- Keep the field name identical wherever the SDK exposes it under the same name (e.g. `data_channel`, `idle_timeout`, `expires_in`, `enable_metrics`).
- Cosmetic differences (snake_case Python vs CamelCase Go) are expected; semantic differences are not.

There is no automated cross-repo check today — review by diffing `server/agent.go` against `server/src/agent.py` before merging.

## See Also

- [Back to Architecture](../02_architecture.md)
- [Back to Workflows](../05_workflows.md)
- [Session Lifecycle](session_lifecycle.md)
