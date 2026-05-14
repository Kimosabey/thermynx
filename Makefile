.PHONY: dev deps stop reset logs obs obs-stop worker migrate migrate-create migrate-stamp

# Start stateful deps (Postgres + Redis + Redis Commander UI)
deps:
	docker compose up -d
	@echo "Waiting for Postgres..."
	@docker compose exec postgres pg_isready -U thermynx -d thermynx_app -q || sleep 3
	@echo ""
	@echo "Redis UI →  http://localhost:8081  (Redis Commander)"

# Backend in one terminal  →  make backend
backend:
	cd backend && uvicorn main:app --reload --port 8000

# Frontend in another terminal  →  make frontend
frontend:
	cd frontend && npm run dev

# Print the 3 commands needed to start everything
dev:
	@echo ""
	@echo "  Start deps (once):   make deps"
	@echo "    → Postgres · Redis · http://localhost:8081 (Redis UI)"
	@echo "  Terminal 1 backend:  make backend"
	@echo "  Terminal 2 frontend: make frontend"
	@echo ""

stop:
	docker compose down

# Wipe Postgres data and restart clean (POC only)
reset:
	docker compose down -v
	docker compose up -d

logs:
	docker compose logs -f

# ── Observability stack (Prometheus + Loki + Grafana) ─────────────────────────

# Start observability stack (Grafana at http://localhost:3000)
obs:
	docker compose --profile obs up -d
	@echo "Grafana →  http://localhost:3000  (no login required)"
	@echo "Prometheus → http://localhost:9090"
	@echo "Loki  →  http://localhost:3100"

obs-stop:
	docker compose --profile obs down

# ── arq job worker ────────────────────────────────────────────────────────────

# Run the arq worker in a dedicated terminal (production-style, separate process)
worker:
	cd backend && ../.venv/Scripts/python -m arq app.jobs.worker.WorkerSettings

# ── Database migrations (Alembic) ─────────────────────────────────────────────

# Apply all pending migrations
migrate:
	cd backend && alembic upgrade head

# Create a new migration (auto-generates from models diff)
# Usage: make migrate-create MSG="add foo column"
migrate-create:
	cd backend && alembic revision --autogenerate -m "$(MSG)"

# Stamp an existing DB as up-to-date without running migrations
# Run this once on a DB that was created by create_all before Alembic was added
migrate-stamp:
	cd backend && alembic stamp head
