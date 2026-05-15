# Graylinx — Architecture Reference

Visual architecture and system flows for Graylinx. Every diagram below is **rendered live** on GitHub (and any Mermaid-aware viewer). Source `.mmd` files live in [`diagrams/`](./diagrams/) — see [diagrams/README.md](./diagrams/README.md) for HD export instructions.

> **Reading order:** §1 system context → §2 backend layers → §3–§5 sequence flows → §6 ERD → §7 deployment → §8 data flow.

---

## 1. System Context (C4 — Level 1)

Who uses Graylinx, what Graylinx is, and what it talks to. The two external systems (MySQL `unicharm` and the Ollama server) are reached over Tailscale.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '16px'}}}%%
flowchart TB
    subgraph Users["👤 Users"]
        Op["Plant Operator"]
        Eng["Energy Engineer"]
        Mgr["Facility Manager"]
        Maint["Maintenance Lead"]
    end

    subgraph Graylinx["🟦 Graylinx Platform"]
        SPA["React + TypeScript SPA<br/>Vite · Chakra UI · TanStack Query"]
        API["FastAPI Backend<br/>asyncio · /api/v1/*<br/>SSE streaming · Agentic loop"]
        PG[("PostgreSQL<br/>thermynx_app<br/>users · threads · audit<br/>rollups · pgvector · agent_runs")]
        Redis[("Redis<br/>cache · prompt cache<br/>arq queue (post-POC)")]
    end

    subgraph External["🔒 External (Tailscale)"]
        MySQL[("MySQL unicharm:3307<br/>READ-ONLY<br/>HVAC telemetry source")]
        Ollama["🧠 Ollama Server<br/>RTX 4000 Ada · 20 GB VRAM<br/>qwen2.5:14b · phi · nemotron"]
    end

    Op & Eng & Mgr & Maint -->|HTTPS| SPA
    SPA <-->|fetch / SSE| API
    API <--> PG
    API <--> Redis
    API -->|read-only SQL| MySQL
    API <-->|stream + tool-calling| Ollama

    classDef platform fill:#1e3a5f,stroke:#3b82f6,color:#fff
    classDef external fill:#1f2937,stroke:#6b7280,color:#fff
    classDef users fill:#374151,stroke:#9ca3af,color:#fff
    classDef pg fill:#0d4f3c,stroke:#22c55e,color:#fff
    classDef cache fill:#7c2d12,stroke:#f97316,color:#fff
    classDef mysql fill:#3b1e1e,stroke:#ef4444,color:#fff
    classDef llm fill:#3730a3,stroke:#818cf8,color:#fff

    class Graylinx platform
    class External external
    class Users users
    class PG pg
    class Redis cache
    class MySQL mysql
    class Ollama llm
```

---

## 2. Backend Container View (C4 — Level 2)

The FastAPI process internally as a five-layer stack. Dependencies point **inward**: domain has zero I/O, services orchestrate, infra is replaceable.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '15px'}}}%%
flowchart TB
    Client["React + TypeScript SPA<br/>Chakra UI · TanStack Query · Zustand"]

    subgraph Backend["🟦 FastAPI Backend (single process, asyncio)"]
        direction TB
        Transport["📡 Transport Layer<br/>/api/v1/* routers · Pydantic v2 models<br/>OpenAPI auto-spec · SSE for /analyze and /agent/investigate"]

        Middleware["🛡️ Middleware Chain<br/>request_id → CORS → security headers<br/>→ auth (post-POC) → rate-limit (post-POC)<br/>→ structlog binder → OTel span (post-POC)"]

        Services["⚙️ Service Layer<br/>EquipmentSvc · TimeseriesSvc · AnalysisSvc<br/>EfficiencySvc · AnomalySvc · ForecastSvc<br/>AgentSvc · MaintenanceSvc · CostSvc · ReportSvc · AuditSvc"]

        Domain["💎 Domain Layer (pure, no I/O)<br/>kW/TR calc · efficiency bands · z-score detector<br/>PromptBuilder · ReAct tool-loop · TimeRange invariants"]

        Infra["🔌 Infrastructure / Repos<br/>TelemetryRepo (aiomysql) · AppRepo (asyncpg)<br/>LLMClient (httpx → Ollama) · CacheClient (redis-py)<br/>EmbeddingClient (Phase 4) · JobScheduler (APScheduler)"]

        Transport --> Middleware --> Services
        Services --> Domain
        Services --> Infra
    end

    Client <-->|HTTPS · SSE| Transport

    Infra -->|read-only| MySQL[("MySQL unicharm")]
    Infra <-->|read/write| Postgres[("Postgres thermynx_app<br/>+ pgvector (Phase 4)")]
    Infra <--> Redis[("Redis<br/>cache + prompt cache")]
    Infra <-->|stream + tools| Ollama["Ollama LLM"]

    classDef domain fill:#0d4f3c,stroke:#22c55e,color:#fff,font-weight:bold
    classDef service fill:#1e3a5f,stroke:#3b82f6,color:#fff
    classDef transport fill:#3730a3,stroke:#818cf8,color:#fff
    classDef middleware fill:#7c2d12,stroke:#f97316,color:#fff
    classDef infra fill:#374151,stroke:#9ca3af,color:#fff

    class Domain domain
    class Services service
    class Transport transport
    class Middleware middleware
    class Infra infra
```

---

## 3. UC1 — Live AI Analyzer flow

End-to-end of the hero use case: the user picks chiller_1, last 24 hours, asks "explain efficiency". Three coloured bands group the cache lookup, the data fetch, and the AI streaming step.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '14px'}}}%%
sequenceDiagram
    autonumber
    actor User
    participant SPA as React SPA
    participant API as FastAPI
    participant Cache as Redis
    participant MySQL as MySQL<br/>unicharm
    participant PG as Postgres<br/>thermynx_app
    participant Ollama as Ollama<br/>qwen2.5:14b

    User->>SPA: pick chiller_1, range=24h<br/>ask "explain efficiency"

    rect rgb(30, 58, 95)
        Note over SPA,API: Equipment catalog
        SPA->>API: GET /api/v1/equipment
        API->>Cache: L2 lookup
        Cache-->>API: MISS
        API->>MySQL: SELECT FROM information_schema
        MySQL-->>API: equipment list
        API->>Cache: SET (5m TTL)
        API-->>SPA: 200 [equipment]
    end

    rect rgb(13, 79, 60)
        Note over SPA,MySQL: Timeseries fetch
        SPA->>API: GET /timeseries?range=24h&res=5m
        API->>Cache: L3 Redis lookup
        Cache-->>API: MISS
        API->>MySQL: SELECT * FROM chiller_1_normalized<br/>WHERE slot_time BETWEEN ...
        MySQL-->>API: ~288 points
        API->>Cache: SET (60s TTL)
        API-->>SPA: 200 [points]
        SPA->>SPA: render Recharts
    end

    rect rgb(55, 48, 163)
        Note over SPA,Ollama: AI Analysis (streaming)
        SPA->>API: POST /api/v1/analyze {eq, range, q}
        API->>PG: INSERT analysis_audit<br/>(status=streaming)
        API->>API: PromptBuilder.build(eq, stats, q)
        API->>Cache: L4 prompt cache check
        Cache-->>API: MISS
        API->>Ollama: POST /api/generate (stream=true)

        loop for each token chunk
            Ollama-->>API: chunk (line-delimited JSON)
            API-->>SPA: SSE data: {type:token, content}
            SPA->>SPA: append + re-render markdown
        end

        Ollama-->>API: done=true
        API->>Cache: SET prompt cache (1h)
        API->>PG: UPDATE audit (status=ok,<br/>response_hash, tokens, total_ms)
        API-->>SPA: SSE data: {type:done}
        SPA-->>User: rendered investigation
    end
```

---

## 4. Agentic Investigator (ReAct loop)

The Phase 3 "AI Agent" sidebar feature. User states a high-level goal; the agent autonomously decides which tools to call, iterates, and synthesizes a final report. Each tool result streams back to the SPA as it happens, so the user sees the agent's reasoning live.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '14px'}}}%%
sequenceDiagram
    autonumber
    actor User
    participant SPA as React SPA<br/>(AI Agent page)
    participant API as FastAPI<br/>AgentService
    participant Tools as Tool Registry<br/>(get_timeseries,<br/>compute_efficiency,<br/>detect_anomalies, ...)
    participant Ollama as Ollama<br/>qwen2.5:14b<br/>(tool-calling)
    participant PG as Postgres<br/>agent_runs

    User->>SPA: "investigate chiller_1's<br/>recent performance"
    SPA->>API: POST /api/v1/agent/investigate<br/>{goal, max_steps:8}
    API->>PG: INSERT agent_runs<br/>(status=running, goal)

    rect rgb(55, 48, 163)
        Note over API,Ollama: ReAct loop — step 1
        API->>Ollama: chat(messages, tools=[schemas])
        Ollama-->>API: {tool_call: compute_efficiency,<br/>args:{eq:chiller_1, range:24h}}
        API-->>SPA: SSE thought + tool_call
        API->>Tools: execute(compute_efficiency, args)
        Tools-->>API: {band:poor, kW/TR:0.82, drivers:[...]}
        API-->>SPA: SSE tool_result
        API->>API: append result to messages
    end

    rect rgb(13, 79, 60)
        Note over API,Ollama: ReAct loop — step 2
        API->>Ollama: chat(messages, tools)
        Ollama-->>API: {tool_call: detect_anomalies, args}
        API-->>SPA: SSE tool_call
        API->>Tools: execute(detect_anomalies, args)
        Tools-->>API: [anomaly: ΔT collapsed at 14:32]
        API-->>SPA: SSE tool_result
    end

    rect rgb(124, 45, 18)
        Note over API,Ollama: ReAct loop — step 3
        API->>Ollama: chat(messages, tools)
        Ollama-->>API: {tool_call: compare_equipment,<br/>args:{a:chiller_1, b:chiller_2}}
        API->>Tools: execute(compare_equipment)
        Tools-->>API: {chiller_2 is 0.18 kW/TR better}
        API-->>SPA: SSE tool_result
    end

    Note over API,Ollama: LLM decides it has enough info

    Ollama-->>API: {final: "# Investigation: chiller_1<br/>**Findings:** poor efficiency band,<br/>ΔT collapse at 14:32, ..."}
    API->>PG: UPDATE agent_runs<br/>(status=ok, steps:3, final_output)
    API-->>SPA: SSE final
    SPA-->>User: rendered investigation report<br/>+ tool-call trace timeline
```

---

## 5. Anomaly background scan

Runs every 5 minutes via APScheduler in-process (POC) — moves to arq workers post-POC. Scans every equipment, compares against the hour-of-day baseline, persists hits, and asks `phi:latest` for a one-line narrative.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '14px'}}}%%
sequenceDiagram
    autonumber
    participant Sched as APScheduler<br/>(every 5 min)
    participant Worker as anomaly_scan job
    participant MySQL as MySQL<br/>unicharm
    participant PG as Postgres<br/>thermynx_app
    participant Ollama as Ollama<br/>phi:latest
    participant Redis

    Sched->>Worker: fire job @ T+0
    Worker->>PG: SELECT equipment_id<br/>FROM equipment_catalog
    PG-->>Worker: [chiller_1, chiller_2, ...]

    loop for each equipment_id
        Worker->>MySQL: SELECT last 60 min<br/>FROM {eq}_normalized
        MySQL-->>Worker: points
        Worker->>PG: SELECT mean, stddev<br/>FROM baselines<br/>WHERE eq=? AND hour_of_day=?
        PG-->>Worker: baseline
        Worker->>Worker: AnomalyDomain.detect<br/>(points, baseline)

        alt z_score > 3
            Worker->>PG: INSERT anomalies<br/>(eq, metric, started_at, z, severity)
            Worker->>Ollama: phi: narrate(anomaly)
            Note over Ollama: small, fast — sub-second
            Ollama-->>Worker: short summary
            Worker->>PG: UPDATE anomalies<br/>SET narrative
            Worker->>Redis: PUBLISH "anomalies.new"<br/>(SPA ws subscribes — post-POC)
        end
    end

    Note over Sched,Redis: hourly: baseline_refresh job<br/>recomputes hour-of-day means per equipment<br/>UPSERTs into baselines table
```

---

## 6. Database ERD — `thermynx_app`

The Postgres schema Graylinx owns. `unicharm` MySQL is read-only and not shown here. ULIDs everywhere for time-sortable IDs. `embeddings` table appears in Phase 4.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '13px'}}}%%
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "has"
    USERS ||--o{ THREADS : "owns"
    USERS ||--o{ ANALYSIS_AUDIT : "performs"
    USERS ||--o{ FEEDBACK : "gives"
    USERS ||--o{ AGENT_RUNS : "runs"
    THREADS ||--o{ MESSAGES : "contains"
    THREADS ||--o{ ANALYSIS_AUDIT : "groups"
    PROMPT_VERSIONS ||--o{ ANALYSIS_AUDIT : "used_by"
    ANALYSIS_AUDIT ||--o{ FEEDBACK : "rated_by"

    USERS {
        ulid id PK
        string username UK
        string email UK
        string password_hash
        string role
        timestamp created_at
    }

    REFRESH_TOKENS {
        ulid id PK
        ulid user_id FK
        string token_hash UK
        timestamp expires_at
        timestamp revoked_at
    }

    THREADS {
        ulid id PK
        ulid user_id FK
        string title
        timestamp created_at
        timestamp archived_at
    }

    MESSAGES {
        ulid id PK
        ulid thread_id FK
        string role
        text content
        int tokens_in
        int tokens_out
        timestamp created_at
    }

    ANALYSIS_AUDIT {
        ulid id PK
        ulid user_id FK
        ulid thread_id FK
        ulid prompt_version_id FK
        string equipment_id
        string prompt_hash
        string response_hash
        string model
        int total_ms
        string status
        string request_id
        timestamp created_at
    }

    PROMPT_VERSIONS {
        int id PK
        string name
        int version
        text template
        boolean active
    }

    FEEDBACK {
        ulid id PK
        ulid audit_id FK
        ulid user_id FK
        int rating
        boolean actioned
        timestamp created_at
    }

    HOURLY_KPI {
        string equipment_id PK
        timestamp hour_bucket PK
        float kw_avg
        float kw_per_tr_avg
        int run_minutes
    }

    DAILY_KPI {
        string equipment_id PK
        date day_bucket PK
        float kw_avg
        float kw_per_tr_avg
        float run_hours
    }

    ANOMALIES {
        ulid id PK
        string equipment_id
        string metric
        timestamp started_at
        float z_score
        string severity
        text narrative
    }

    BASELINES {
        string equipment_id PK
        string metric PK
        int hour_of_day PK
        float mean
        float stddev
    }

    AGENT_RUNS {
        ulid id PK
        ulid user_id FK
        string goal
        int steps_taken
        string status
        text final_output
        timestamp created_at
    }

    EMBEDDINGS {
        ulid id PK
        string source_type
        string source_id
        int chunk_idx
        text content
        vector embedding
    }
```

---

## 7. POC Deployment Topology

POC runs on **one developer laptop** plus the Tailscale-attached Ollama server. No nginx, no TLS, no registry — just `make dev`.

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '15px'}}}%%
flowchart TB
    Browser["🌐 Browser<br/>localhost:5173"]

    subgraph Laptop["💻 Developer Laptop (POC host)"]
        direction TB
        Vite["Vite Dev Server :5173<br/>HMR · TanStack Query · Chakra UI"]

        subgraph Compose["docker compose stack"]
            direction LR
            API["api<br/>uvicorn :8000<br/>--reload"]
            PG[("postgres<br/>thermynx_app<br/>:5432")]
            Redis[("redis<br/>:6379")]
        end

        Vite -->|/api proxy| API
        API <--> PG
        API <--> Redis
    end

    subgraph TS["🔒 Tailscale network"]
        direction TB
        OllamaSrv["🖥️ Ollama Server<br/>Dell Pro Max Tower<br/>Intel Ultra 9 285K · 32 GB RAM<br/>NVIDIA RTX 4000 Ada · 20 GB VRAM<br/>Win 11 Pro<br/>Models: qwen2.5:14b (default)<br/>· phi · nemotron · gpt-oss<br/>:11434"]
            MySQL[("🗄️ MySQL unicharm:3307<br/>READ-ONLY user<br/>HVAC telemetry source")]
    end

    Browser --> Vite
    API -->|aiomysql, RO| MySQL
    API <-->|httpx · stream + tools| OllamaSrv

    classDef laptop fill:#1e3a5f,stroke:#3b82f6,color:#fff
    classDef ts fill:#1f2937,stroke:#6b7280,color:#fff
    classDef compose fill:#0f1f3a,stroke:#60a5fa,color:#fff
    classDef llm fill:#3730a3,stroke:#818cf8,color:#fff
    classDef mysql fill:#3b1e1e,stroke:#ef4444,color:#fff

    class Laptop laptop
    class TS ts
    class Compose compose
    class OllamaSrv llm
    class MySQL mysql
```

---

## 8. End-to-end Data Flow

How a chiller reading travels from the BMS / PLC all the way to a rendered LLM markdown answer (with optional RAG retrieval in Phase 4).

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'fontSize': '14px'}}}%%
flowchart LR
    BMS["🏭 Unicharm BMS / PLCs<br/>(upstream — not ours)"]
    Raw["MySQL raw tables<br/>*_metric · *_om_p"]
    Norm["MySQL normalized<br/>*_normalized<br/>slot_time bucketed"]

    BMS -->|"telemetry ingest"| Raw
    Raw -->|"normalization<br/>Graylinx ingestion"| Norm

    Norm -->|"GET /timeseries<br/>direct read · cached 60s"| API
    Norm -->|"hourly arq job"| Rollup["Postgres<br/>hourly_kpi · daily_kpi"]
    Norm -->|"every 5 min APScheduler"| AnomDet["Anomaly Detector<br/>z-score vs baselines"]
    AnomDet --> Anom["Postgres<br/>anomalies"]

    API["FastAPI<br/>Service Layer"] -->|stats + context| PromptBuild["Prompt Builder<br/>(domain, pure)"]
    PromptBuild -->|chat / tool-calling| Ollama["Ollama<br/>qwen2.5:14b"]
    Ollama -->|SSE chunks| API
    API -->|audit + cache| PG[("Postgres<br/>analysis_audit<br/>prompt_cache · agent_runs")]
    API -->|streamed markdown| SPA["React SPA"]

    Rollup -.->|"snappy dashboards"| API
    Anom -.->|"alerts feed"| API

    Manuals["📄 Equipment manuals<br/>ASHRAE guides<br/>(Phase 4)"] -->|"ingest · chunk · embed<br/>nomic-embed-text"| Embed[("Postgres<br/>embeddings (pgvector)")]
    Embed -.->|"retrieve top-k chunks"| PromptBuild

    classDef bms fill:#3b1e1e,stroke:#ef4444,color:#fff
    classDef raw fill:#3b1e1e,stroke:#ef4444,color:#fff
    classDef norm fill:#0d4f3c,stroke:#22c55e,color:#fff
    classDef rollup fill:#0d4f3c,stroke:#22c55e,color:#fff
    classDef anom fill:#7c2d12,stroke:#f97316,color:#fff
    classDef ollama fill:#3730a3,stroke:#818cf8,color:#fff
    classDef pg fill:#1e3a5f,stroke:#3b82f6,color:#fff

    class BMS bms
    class Raw raw
    class Norm norm
    class Rollup rollup
    class Anom anom
    class AnomDet anom
    class Ollama ollama
    class PG pg
    class Embed pg
```

---

## Exporting these to slide-deck PNGs

For Keynote / PowerPoint / Google Slides, see [`diagrams/README.md`](./diagrams/README.md). One-liner:

```bash
cd docs/diagrams
npm install -g @mermaid-js/mermaid-cli
for f in *.mmd; do
  mmdc -i "$f" -o "${f%.mmd}.png" -w 3840 -H 2160 -b "#0f172a"
done
```

Edit the `.mmd` source files when the architecture changes — never edit rendered images directly.
