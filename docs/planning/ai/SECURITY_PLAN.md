# AI security plan

**Audience:** Engineers + security reviewers · Mapped to **OWASP LLM Top 10 (2025)** and NIST AI RMF.

Sibling docs: [AI_PLATFORM_EXCELLENCE.md](./README.md) · [AI_HALLUCINATION_DEFENSES.md](./HALLUCINATION_DEFENSES.md) · [AI_RELIABILITY_PLAN.md](./RELIABILITY_PLAN.md)

**Last updated:** 2026-05-28

---

## Threat model in one paragraph

The platform is an internal HVAC ops tool deployed on-prem at a single facility (Unicharm) for a small ops team (~5–15 operators). It has no public internet exposure, no PII beyond Slack username if Slack is configured, and **no control over physical equipment** (read-only telemetry). The most severe realistic threats are:

1. An operator (or a poisoned doc in the knowledge base) tricking the LLM into giving dangerously wrong operational advice.
2. A compromised credential (LLM model, MySQL, Ollama host) leading to data exfil or model poisoning.
3. A supply-chain attack on Ollama / pip dependencies / npm dependencies.

We don't model nation-state-level adversaries for the POC. Defenses are proportionate.

---

## OWASP LLM Top 10 (2025) — control mapping

| ID | Risk | Our exposure | Controls in place | Gap / planned |
|---|---|---|---|---|
| **LLM01** | Prompt injection | 🟡 Medium — RAG content, user questions | Validator on NL-Query, equipment allow-list in prompt | RAG content-as-data wrapper (T1-C), injection-resistance rule (T1-B) — see [hallucination roadmap](./HALLUCINATION_ROADMAP.md) |
| **LLM02** | Sensitive information disclosure | 🟢 Low — no PII in telemetry | System prompt not leaked unless model overridden; Postgres credentials not in any LLM-visible context | Periodic prompt audit; logging excludes secrets |
| **LLM03** | Supply chain | 🟡 Medium — Ollama, pip, npm | `requirements.txt` and `package.json` pinned; dependabot not yet enabled | Enable dependabot or `pip-audit` weekly; Ollama model hash verification |
| **LLM04** | Data and model poisoning | 🟡 Medium — RAG knowledge base | Knowledge base files reviewed before ingest | Ingest-time scan for prompt-injection patterns; chunk hash + dedupe |
| **LLM05** | Improper output handling | 🟢 Low | ReactMarkdown sanitizes HTML; NL-Query validator blocks SQL injection | Output is never executed (no shell exec, no eval); no LLM output piped into another LLM without context wrapping |
| **LLM06** | Excessive agency | 🟢 Low — read-only by design | No actuator tools; no email/Slack send-from-agent | Read-only assertion in system prompts (T1-A); enforce in code: tool registry has NO write tools |
| **LLM07** | System prompt leakage | 🟡 Medium | Standard qwen2.5:14b resistance | Injection-resistance rule (T1-B); never include real secrets in any prompt |
| **LLM08** | Vector and embedding weaknesses | 🟢 Low | nomic-embed-text is local; relevance threshold 0.55 | Periodic re-ingest from authoritative sources; embedding consistency check |
| **LLM09** | Misinformation | 🔴 Open | Self-critique pass + numeric audit planned | Full [hallucination plan](./HALLUCINATION_GUARDRAILS.md) addresses this end-to-end |
| **LLM10** | Unbounded consumption | 🟢 Low | slowapi rate limits, token budgets, payload bounds | Continue enforcement; expand to per-user (currently per-IP) when auth lands |

---

## Authentication & authorization

### Current state

- API key auth implemented but **disabled by default** (`API_KEYS=""` in config)
- When enabled, `X-API-Key` header validates against comma-separated list in env
- No per-user identity, no RBAC
- Exempted endpoints: `/healthz`, `/metrics`, `/docs*`, `/openapi.json`, `/api/v1/health`

### Gaps

| Gap | Severity | Plan |
|---|---|---|
| Default `API_KEYS=""` ships open | 🟡 Medium for prod | Refuse to start when `API_KEYS` is empty AND env != dev |
| No per-user identity | 🟢 Low for POC | Phase 2 — Slack SSO or Microsoft Entra after POC |
| No RBAC (everyone can hit every endpoint) | 🟢 Low | POC scope; defer |
| Rate limit is per-IP not per-user | 🟢 Low | Move to per-API-key when auth becomes mandatory |
| No audit of *who* hit what AI endpoint | 🟡 Medium | Add `actor` column to `analysis_audit` once auth lands |

### Recommended hardening for production deploy

1. Refuse to start with `API_KEYS=""` outside dev mode
2. Rotate API keys every 90 days (process; not code)
3. Enable HTTPS termination at the deployment edge
4. Restrict `OLLAMA_HOST` to Tailscale or VPN-only IPs
5. Restrict MySQL credentials to read-only role on the telemetry user

---

## Secrets management

### Current secret surface

| Secret | Where | How protected |
|---|---|---|
| `DB_PASSWORD` (MySQL) | env / `.env` | Outside git; default `"changeme"` should be rejected in prod startup check |
| `POSTGRES_URL` (with password) | env / `.env` | Same |
| `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | env / `.env` | Same; empty disables Slack paths |
| `API_KEYS` | env / `.env` | Same |
| Ollama — no auth currently | Tailscale-isolated network |
| Model files on Ollama host | Filesystem | Standard FS permissions |

### Rules

1. **Never commit `.env`** — present in `.gitignore`, verify periodically
2. **Never log secret values** — `app.log` has structured fields; review log lines that include `body` for accidental leaks
3. **Never send secrets to the LLM** — system prompts must not contain credentials; verify with grep
4. **Refuse to start on default credentials** — startup check for `DB_PASSWORD == "changeme"` etc

### Planned: startup secret validation

**Status:** ⏳ Planned · **Effort:** 1 hour

In `main.py` lifespan, check:
- `DB_PASSWORD != "changeme"` if `ENV != "dev"`
- `API_KEYS != ""` if `ENV != "dev"`
- `POSTGRES_URL` doesn't contain `"dev"` substring in prod
- Refuse to boot with `RuntimeError` if any violation

---

## Input validation summary

### `/nl-query` — strictest

- Pydantic: `min_length=3, max_length=1000`
- Validator rejects: comments, semicolons, non-SELECT, forbidden tokens, unknown tables, LIMIT > 1000
- Status: 🟢 Strong

### `/analyze`

- Pydantic: `question` `min_length=3, max_length=2000`
- Pydantic: `hours` must be int, bounded
- Pydantic: `equipment_id` optional, validated via `get_by_id` before use
- Status: 🟢 Strong

### `/agent/run`

- Pydantic: `mode` validated against agent mode list
- Pydantic: `goal` bounded
- Pydantic: `context` is optional dict (loose — tool args validated downstream)
- Status: 🟡 Partial — `context` permissiveness is intentional (we want flexibility) but adds attack surface; downstream tools must validate every arg

### `/vision` (single image / compare)

- Image base64 validated for: decodability, size cap 6 MiB
- No prompt injection vector (prompt is fixed)
- Status: 🟢 Strong

---

## Output handling

### Where LLM output flows

| Sink | Risk | Control |
|---|---|---|
| Frontend markdown render | XSS | ReactMarkdown escapes HTML; no `dangerouslyAllowHTML` |
| Postgres `messages.content` | Stored XSS on later render | Same — render with ReactMarkdown |
| `analysis_audit.response_hash` | Re-execution | Only the **hash** is stored; raw response in DB is text-only |
| Tool call args (LLM-generated) | Eval / injection | Args pass through Python kwargs filtering in `execute_tool`, then validated per-tool |
| SQL (LLM-generated) | Injection | Strict validator before MySQL execution |

LLM output **never** goes to shell, eval, exec, file write, or external HTTP without explicit handling.

---

## Audit & forensics

### What we log

| Event | Where | Retention |
|---|---|---|
| Every analyzer request | `analysis_audit` table in Postgres | Indefinite |
| Every NL-Query | `services.nl_to_sql` logs (Loki) | 30 days (Loki default config) |
| Every agent run | `services.agent` logs (Loki) + Prometheus counters | 30 days logs / indefinite metrics |
| Every tool error | `services.agent` logs (Loki) | 30 days |
| Ollama unavailable events | Loki | 30 days |

### What we do NOT log

- Secret values (never in prompts or response bodies)
- Full LLM response bodies in non-audit logs (truncated)
- Image bytes (vision endpoint logs only metadata)

### Forensics queries

```bash
# Find all analyzer requests for a given audit_id
curl 'http://localhost:3100/loki/api/v1/query_range' \
  --data-urlencode 'query={service="backend"} |= "audit_id=<UUID>"'

# Find recent hallucination flags (after T3-D lands)
curl 'http://localhost:9292/api/v1/query?query=hallucination_flags_total'
```

---

## Supply chain

### Backend Python deps

- Pinned in `requirements.txt`
- Audit: `pip-audit` runs in CI (TBD — currently manual)
- High-risk deps: `httpx`, `sqlalchemy`, `fastapi`, `pydantic`, `ollama-python` (none used currently)

### Frontend Node deps

- Pinned via `package-lock.json`
- Audit: `npm audit` (manual)
- High-risk: `react-markdown` (XSS surface), `echarts`, `@chakra-ui/react`

### Ollama & models

- Models downloaded on first use; no signature check by default
- Recommendation: capture model digests in deployment notes, verify on update

---

## Roadmap

| Tier | Item | Effort | Status |
|---|---|---|---|
| 🔥 | Read-only assertion (T1-A from hallucination plan) | 30 min | ⏳ |
| 🔥 | Injection-resistance rule (T1-B) | 15 min | ⏳ |
| 🔥 | RAG content as data wrapper (T1-C) | 45 min | ⏳ |
| ⚡ | Startup secret validation | 1 hr | ⏳ |
| ⚡ | `pip-audit` + `npm audit` in CI | 1 hr | ⏳ |
| ⚡ | Refuse-to-start on empty API_KEYS in non-dev | 30 min | ⏳ |
| 🌱 | Per-user identity (Slack SSO or Entra) | 1–2 days | 🌱 Post-POC |
| 🌱 | RBAC on AI endpoints | 1 day | 🌱 Post-POC |
| 🌱 | Ollama model hash verification | 2 hrs | 🌱 Post-POC |

---

## Pre-deployment security checklist

Before any non-dev deployment:

- [ ] All secrets set via env, none in code
- [ ] `API_KEYS` non-empty
- [ ] `DB_PASSWORD` not `"changeme"`
- [ ] `POSTGRES_URL` doesn't use the dev default
- [ ] CORS origins restricted to actual frontend domain (no `*`)
- [ ] `pip-audit` shows no high/critical vulns
- [ ] `npm audit` shows no high/critical vulns
- [ ] HTTPS termination configured (nginx / Caddy / cloud LB)
- [ ] Ollama only reachable from backend host (Tailscale ACL or VPN)
- [ ] MySQL user has SELECT only on telemetry tables
- [ ] Postgres user has CRUD on `thermynx_app` schema only
- [ ] Logs not exposing secret values (`grep -E "password|token" logs/*.log` returns nothing meaningful)
- [ ] System prompts reviewed for accidentally embedded secrets

---

## Reporting a vulnerability

For POC — direct message Harshan with details. Post-POC — establish a SECURITY.md with disclosure policy.
