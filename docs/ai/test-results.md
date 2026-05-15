# PD Documentation Test Results

Tested: 2026-05-15
Agent: Cursor agent (Anthropic Claude family) with delegated `explore` sub-agents
Repo: `agent-quickstart-go`

## Summary

- Total questions: 8
- Passed: 6
- L1 gaps: 1 (Q4 — `make verify-local` scope)
- L2 gaps: 1 (managed agent config parity note)
- Cross-ref issues: 1 (L2 verification_scripts summary row)

All issues were addressed by editing the affected docs; retests confirmed each fix landed.

## Results

### Setup & Build

| #   | Question                                                                | Answer Correct? | Files Read                                                                                          | Level Loaded     | Result |
| --- | ----------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 1   | How do I install and run dev for both client and server?                | Yes             | `AGENTS.md`, `L0`, `L1/01_setup.md`, `Makefile`, `client/package.json`                              | L0+L1 sufficient | Pass   |
| 2   | Which env vars are required, where do `NEXT_PUBLIC_*` belong, and how does the proxy decide where to send `/api/*`? | Yes | `L0`, `L1/01_setup.md`, `L1/02_architecture.md`, `L1/06_interfaces.md`, `client/next.config.ts`     | L0+L1 sufficient | Pass   |

### Test & Run

| #   | Question                                                                | Answer Correct? | Files Read                                                                                          | Level Loaded     | Result |
| --- | ----------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 3   | What does the verification suite cover and how do I run the whole chain offline? | Yes (with note) | `L1/01_setup.md`, `L1/05_workflows.md`, `L2/verification_scripts.md`, `Makefile`                    | L2 needed        | Pass   |
| 4   | What does `make verify-local` include and what is left out?             | Partial → Pass after fix | `L1/05_workflows.md`, `Makefile`, `package.json`                                          | L0+L1 sufficient | L1 gap → Pass |

### Conventions

| #   | Question                                                                | Answer Correct? | Files Read                                                                                          | Level Loaded     | Result |
| --- | ----------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 5   | What's the boundary between `client/app/api` and `server/`? When do I add a route on either side? | Yes | `AGENTS.md`, `L1/03_code_map.md`, `L1/04_conventions.md`, `L1/07_gotchas.md`, `client/next.config.ts`, `server/api/router.go` | L0+L1 sufficient | Pass   |
| 6   | Where does the agent prompt / voice / VAD config live? How do I change it? | Yes (parity gap) | `L1/05_workflows.md`, `L1/06_interfaces.md`, `L2/managed_agent_config.md`, `server/agent/config.go`, `server/agent/builder.go`, `server/agent/handler.go` | L2 needed        | L2 gap → Pass |

### Development

| #   | Question                                                                | Answer Correct? | Files Read                                                                                          | Level Loaded     | Result |
| --- | ----------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 7   | How would I add a new `/api/foo` endpoint end-to-end (server + client)? | Yes             | `L1/05_workflows.md`, `L1/06_interfaces.md`, `L1/04_conventions.md`, `server/api/router.go`         | L0+L1 sufficient | Pass   |

### Deep Dive

| #   | Question                                                                | Answer Correct? | Files Read                                                                                          | Level Loaded     | Result |
| --- | ----------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 8   | Why does the client run RTM with `uid="0"` while the agent uses a string UID, and how does renewal stay consistent? | Yes | `L1/07_gotchas.md`, `L2/session_lifecycle.md`, `L2/managed_agent_config.md`, `client/components/ConversationComponent.tsx`, `server/agent/handler.go` | L2 needed        | Pass   |

## Recommended Fixes (Applied)

- [x] **L1/05_workflows.md (Finding 1)**: clarify that `make verify-local` aggregates Go + Node toolchain checks (`verify:check-go`, `verify:check-node`, `make build-server`, `make verify-go`, `make verify-web-api`, `make verify-web-proxy`, `make verify-web-build`) and explicitly does *not* spawn the FakeAgent server or live Agora.
- [x] **L2/managed_agent_config.md (Finding 2)**: add a "Parity With the Python Quickstart" section listing the four cross-quickstart fields (`name`, `system_messages`, `voice_id`, `vad_config`) and the rationale for keeping them aligned.
- [x] **L2/verification_scripts.md (Finding 3)**: rewrite the `verify-local-proxy.ts` row of the summary table so it matches the dedicated section ("Imports `next.config.ts`, resolves rewrites, fetches an in-process stub directly").

## Review Fix Retest

Retested: 2026-05-15

| Finding                                                  | Source checked                                                                                          | Docs changed                              | Result | Notes |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------ | ----- |
| `make verify-local` scope                                | `Makefile`, `client/package.json`                                                                       | `L1/05_workflows.md`                       | Pass   | Aggregated steps + exclusions now stated. |
| Managed agent config parity note                         | `server/agent/config.go`, `agent-quickstart-python/server/src/agent.py`                                  | `L2/managed_agent_config.md`               | Pass   | Cross-quickstart fields enumerated. |
| L2 verification_scripts summary row drift                | `client/scripts/verify-local-proxy.ts`, `client/next.config.ts`                                          | `L2/verification_scripts.md`               | Pass   | Summary table row now matches dedicated description. |
