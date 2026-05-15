# Managed Agent Config

> **When to Read This:** Load this document when you are changing the agent's prompt, voice, VAD behavior, model selection, session options, or wiring a bring-your-own-key (BYOK) provider on the Go side.

## Where It Lives

All managed agent configuration is in `server/agent.go`. The browser sends `{ channelName, rtcUid, userUid }` to `POST /startAgent`, which calls `agentService.start(...)`. That function builds an SDK-driven agent and starts a session.

## The Agent Builder Chain

```go
agent := agentkit.NewAgent().
    WithInstructions(adaPrompt).
    WithGreeting(firstNonEmpty(os.Getenv("AGENT_GREETING"), defaultGreeting)).
    WithFailureMessage(defaultFailureMessage).
    WithMaxHistory(15).
    WithTurnDetectionConfig(agentkit.TurnDetectionConfig{
        SpeechThreshold:    float64Ptr(0.5),
        StartMode:          "vad",
        InterruptDurationMs: intPtr(160),
        PrefixPaddingMs:    intPtr(300),
        EndMode:            "vad",
        SilenceDurationMs:  intPtr(480),
    }).
    WithAdvancedFeatures(map[string]any{
        "enable_rtm":   true,
        "enable_tools": true,
    }).
    WithLlm(vendors.NewOpenAI(vendors.OpenAIOptions{
        Model:       "gpt-4o-mini",
        MaxHistory:  intPtr(15),
        MaxTokens:   intPtr(1024),
        Temperature: float64Ptr(0.7),
        TopP:        float64Ptr(0.95),
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

The exact field names match `agora-agent-server-sdk-go` v1.3.4. If you bump the SDK, re-check field names — some options moved between minor versions.

## Session Options

```go
session, err := agent.CreateSession(ctx, agentkit.CreateSessionOptions{
    ChannelName:        req.ChannelName,
    RemoteUids:         []string{strconv.Itoa(req.UserUid)},
    IdleTimeout:        30,
    ExpiresIn:          agentkit.ExpiresInHours(1),
    EnableStringUID:    false,
    DataChannel:        "rtm",
    EnableRtm:          true,
    EnableTools:        true,
    EnableErrorMessage: true,
})
err = session.Start(ctx)
```

| Option              | Effect                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `RemoteUids`        | Restricts the agent to the requester's UID; prevents cross-channel sniping.                   |
| `IdleTimeout`       | Seconds of silence before the session ends.                                                   |
| `ExpiresIn`         | Hard ceiling, mirrors the 1-hour token.                                                       |
| `EnableStringUID`   | `false` — keeps UIDs numeric for both RTC and RTM.                                            |
| `DataChannel`       | `"rtm"` — transcripts and metrics flow over RTM.                                              |
| `EnableRtm`         | Must remain `true` so the client receives transcript / state / metric events.                 |
| `EnableTools`       | Toggles tool-calling support on the LLM.                                                      |
| `EnableErrorMessage`| Surfaces `message.error` payloads on RTM for the client to render.                            |

## Editing Each Surface

### Change the prompt

Edit the `adaPrompt` string constant at the top of `agent.go`. Keep it concise — long prompts amplify LLM latency.

### Change the greeting

Set `AGENT_GREETING` in `server/.env.local`, or edit the fallback default in `newAgentService`.

### Change VAD

Edit `TurnDetectionConfig`. Tuning notes:

- `SpeechThreshold` — VAD activation sensitivity (0.0–1.0). Lower values trigger on quieter audio.
- `InterruptDurationMs` — minimum user speech before the agent yields. Lower = more responsive interruptions.
- `PrefixPaddingMs` — audio captured before VAD triggers; raise this if early phonemes are clipped.
- `SilenceDurationMs` — silence after speech before VAD ends the turn. Raise this for slow speakers.

### Swap STT / LLM / TTS

Replace the corresponding `vendors.New*` constructor. The SDK exposes alternatives — check `agora-agent-server-sdk-go/vendors`. For a BYOK provider, pass `APIKey: os.Getenv("PROVIDER_API_KEY")` to the constructor and document the env var in `server/.env.example`.

### Session-Level Tuning

- Lower `IdleTimeout` (e.g. 15) for short demos.
- Switch `DataChannel` to `"sct"` only if you are not relying on RTM transcripts.

## Response Contract

`startAgent` returns:

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "agent_id": "string",
    "channel_name": "string",
    "status": "running"
  }
}
```

The client stores `agent_id` in `agoraData` and later passes it to `/api/stopAgent`.

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
| Agent state stuck in `IDLE`                          | `EnableRtm: false` or RTM client subscribed before login completed.     |
| Transcript fragments arrive but no metrics           | `parameters.enable_metrics` not enabled (must remain in advanced features). |
| Build fails: `unknown field "WithAdvancedFeatures"`  | SDK version mismatch; check `server/go.mod` against the import.         |

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
