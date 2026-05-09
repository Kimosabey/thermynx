# THERMYNX AI Backend Architecture Reference

This document provides a technical overview of the backend architecture and AI implementation strategies used in the THERMYNX HVAC AI Operations Intelligence Platform.

## 1. Core Technology Stack

The backend is built as a high-performance, asynchronous Python service designed for industrial-scale HVAC analytics.

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Web Framework** | **FastAPI** | REST API, SSE Streaming, Dependency Injection |
| **Database ORM** | **SQLAlchemy 2.0** | Asynchronous DB operations |
| **MySQL Driver** | **aiomysql** | Connection to Unicharm facility database |
| **Postgres Driver** | **asyncpg** | Connection to Vector/Analytics storage |
| **Task Scheduler** | **APScheduler** | Background anomaly scanning & jobs |
| **Data Validation** | **Pydantic v2** | Request/Response schema validation |

---

## 2. AI Intelligence Stack (The "Vanilla" Approach)

THERMYNX intentionally avoids heavy "all-in-one" AI frameworks (like LangChain or LlamaIndex) in favor of a lean, custom implementation. This provides maximum control, lower latency, and easier customization for HVAC engineering logic.

### A. LLM Engine: Ollama
*   **Protocol:** Direct REST API integration via `httpx`.
*   **Models:** 
    *   **Reasoning:** Llama 3.1 (or similar) via `/api/chat`.
    *   **Embeddings:** `nomic-embed-text` via `/api/embeddings`.
*   **Location:** `backend/app/llm/ollama.py` handles all communication.

### B. Agent Framework: ReAct (Reasoning and Acting)
Instead of a third-party agent library, THERMYNX uses a custom **ReAct Loop** implemented in `backend/app/services/agent.py`.

**The 8-Step ReAct Loop:**
1.  **Prompt:** Send the system persona + user goal + tool definitions to Ollama.
2.  **Thought:** The LLM returns a reasoning step (what it plans to do).
3.  **Action:** If the LLM requests a "Tool Call" (Function Call), the backend intercepts it.
4.  **Execution:** The backend runs the actual Python tool (e.g., `calculate_efficiency`).
5.  **Observation:** The tool result is fed back into the LLM's memory.
6.  **Iteration:** Steps repeat until a final answer is reached (max 8 steps).
7.  **Streaming:** Every thought, tool call, and token is streamed to the UI via **Server-Sent Events (SSE)**.

### C. Retrieval-Augmented Generation (RAG)
RAG is used to give the AI access to facility manuals, SOPs, and technical documents.
*   **Vector Storage:** **PostgreSQL + pgvector extension**.
*   **Search Method:** Cosine Similarity (`<=>` operator) with `ivfflat` indexing.
*   **Logic:** Implemented in `backend/app/services/rag.py`. It embeds the user query and retrieves top-k relevant document chunks to inject into the LLM context.

---

## 3. Why No Heavy AI Frameworks?

| Feature | THERMYNX Approach | Framework Approach (LangChain/etc.) |
| :--- | :--- | :--- |
| **Performance** | Sub-millisecond overhead. | Significant abstraction overhead. |
| **Customization** | Full control over the ReAct loop and prompt formatting. | Often constrained by framework abstractions. |
| **Dependencies** | Minimal. Uses only standard HTTP and DB libraries. | Hundreds of sub-dependencies; frequent breaking changes. |
| **Industrial Safety** | Explicit tool execution logic for critical HVAC data. | "Black box" tool management. |

---

## 4. Directory Structure Reference

*   `backend/main.py`: Entry point, lifecycle management, and global middleware.
*   `backend/app/api/router.py`: Central registration of all module routers.
*   `backend/app/services/agent.py`: Core AI Agent logic and personas.
*   `backend/app/services/rag.py`: Document retrieval and vector search logic.
*   `backend/app/llm/ollama.py`: Low-level Ollama API client.
*   `backend/app/domain/tools.py`: Definitions of all tools available to the AI.
