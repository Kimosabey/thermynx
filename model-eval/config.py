"""Harness configuration — candidate models per mode, judge, knobs.

Models are the candidates pulled on the Ollama server (verified via _probe.py).
Edit freely while evaluating. Judge is held constant to keep scores comparable.
"""
from pathlib import Path

REPORTS_DIR = Path(__file__).resolve().parent / "reports"

# Held-constant judge for open-ended grading (excluded as a candidate in judged
# modes to avoid self-scoring; the runner flags any unavoidable self-judge).
JUDGE_MODEL = "qwen2.5:32b"

# Candidate models per mode.
_AGENTIC = [
    "gpt-oss:20b", "phi4:latest", "mistral-small3.2:latest", "qwen2.5:32b",
    "qwen2.5:14b", "deepseek-r1:32b", "gemma3:27b", "qwq:32b", "llama3.1:8b",
]
MODELS_BY_MODE = {
    "planner":   list(_AGENTIC),
    "validator": list(_AGENTIC),
    # executor = tool-calling agent (native Ollama tools, JSON-mode fallback)
    "executor":  list(_AGENTIC),
    "narration": list(_AGENTIC),
    "rag_qa":    list(_AGENTIC),
    # NL->SQL adds the code-tuned candidate
    "nl_to_sql": list(_AGENTIC) + ["qwen2.5-coder:32b"],
    # embeddings compares embedders, not chat models
    "embeddings": ["nomic-embed-text", "mxbai-embed-large"],
}

ALL_MODES = ["planner", "validator", "executor", "nl_to_sql", "rag_qa", "narration", "embeddings"]

# Cloud candidates for the OpenRouter run (slugs contain "/" → llm.py routes them to
# OpenRouter). Paid tiers only (no :free, which may train on data). Value-add = the
# models that DON'T fit the 20 GB local box: gpt-oss-120b + 70B-class. qwq:32b and
# qwen2.5:32b aren't on OpenRouter (covered locally instead). Embeddings stay local.
# Run: run_eval.py --modes planner,validator,executor,nl_to_sql,rag_qa,narration \
#                  --models <CLOUD_MODELS> --out OPENROUTER_MODEL_EVAL
CLOUD_MODELS = [
    "openai/gpt-oss-120b", "openai/gpt-oss-20b", "microsoft/phi-4",
    "mistralai/mistral-small-3.2-24b-instruct", "google/gemma-3-27b-it",
    "deepseek/deepseek-r1-distill-qwen-32b", "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-72b-instruct", "deepseek/deepseek-r1-distill-llama-70b",
]

# run knobs
N_FAULT_CASES   = 3     # real anomaly windows for planner/validator/narration
N_EXEC_CASES    = 3     # real fault scenarios for the executor tool-calling test
EXEC_MAX_STEPS  = 5     # max tool-calling turns; last turn nudges the model to propose
N_NL_QUESTIONS  = 12    # NL->SQL questions
N_RAG_QUESTIONS = 10    # RAG-QA questions
RAG_TOP_K       = 5
EMBED_SAMPLE    = 20    # corpus chunks sampled for the embeddings hit@k test
EMBED_TOP_K     = 5

# per-call generation knobs
CHAT_TEMPERATURE = 0.1
NARRATION_MAX_TOKENS = 350
REQUEST_TIMEOUT_S = 180.0   # generous — some reasoning models are slow on the 20GB box
