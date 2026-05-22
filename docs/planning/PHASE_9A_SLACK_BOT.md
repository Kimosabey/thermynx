# Phase 9A — Slack/Teams bot (Slack first)

**Status:** queued · **ETA:** ~1d to scaffold a working v0

## Goal

Operators live in Slack. Bring the platform's voice to where they
already are — receive critical alarms, answer `/thermynx <question>`
slash-commands, and produce a `/thermynx brief` shift handover on demand.

## Scope (v0)

| In | Out |
|---|---|
| Outbound: post a Slack message when a critical alarm fires | Per-channel alarm routing rules |
| Inbound: `/thermynx <question>` runs the analyzer and returns markdown | Interactive blocks / buttons |
| Inbound: `/thermynx brief` runs the brief agent | Threaded follow-ups |
| Slack-token config in `.env` (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`) | OAuth installation flow |

## Design

- `services/slack.py` — thin wrapper around `slack-sdk` (`WebClient.chat_postMessage`)
- Background worker: poll `/api/v1/alarms` every 60s, dedupe by alarm-id,
  fire `chat_postMessage` for new critical events
- FastAPI route `POST /slack/events` (verify Slack signature) +
  `POST /slack/commands` for slash commands — both delegate to existing
  `/analyze` / `/agent/run` SSE endpoints, collect to a final string,
  reply via Slack response_url

## Tasks
- [ ] Add `slack-sdk` to `requirements.txt`
- [ ] `services/slack.py` — message + signature verify utilities
- [ ] `api/v1/slack.py` — events + commands routes
- [ ] Background worker registration in `main.py` (arq cron)
- [ ] Smoke-test with a Slack test workspace (manual)
- [ ] Settings page note: where to put SLACK_BOT_TOKEN

## Risks / open questions
- Slack expects responses in <3s; long agent runs need delayed
  `response_url` posting. v0 design assumes this.
- Teams is structurally similar but uses Bot Framework — defer until
  Slack is proven.
