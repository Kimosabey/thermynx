.PHONY: dev deps stop reset logs migrate migrate-create migrate-stamp

# Start stateful deps (Postgres + Redis) in background
deps:
	docker compose up -d
	@echo "Waiting for Postgres..."
	@docker compose exec postgres pg_isready -U thermynx -d thermynx_app -q || sleep 3

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
