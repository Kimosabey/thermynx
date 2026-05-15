.PHONY: dev deps stop reset logs obs obs-stop obs-status obs-logs obs-reload obs-test-alert obs-curl-metrics worker migrate migrate-create migrate-stamp

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
	@echo ""
	@echo "  Grafana       →  http://localhost:3000  (no login)"
	@echo "  Prometheus    →  http://localhost:9090  (Alerts tab: /alerts)"
	@echo "  Alertmanager  →  http://localhost:9093"
	@echo "  Loki          →  http://localhost:3100  (query via Grafana)"
	@echo ""
	@echo "  Pre-built dashboard:  Grafana → Dashboards → Graylinx folder"
	@echo ""
	@echo "  Backend logs into Loki require LOG_FILE=./logs/graylinx-api.log in backend/.env"

obs-stop:
	docker compose --profile obs down

# Show health of every obs container at a glance
obs-status:
	@docker compose ps --filter "label=com.docker.compose.service=prometheus" \
	                   --filter "label=com.docker.compose.service=alertmanager" \
	                   --filter "label=com.docker.compose.service=loki" \
	                   --filter "label=com.docker.compose.service=promtail" \
	                   --filter "label=com.docker.compose.service=grafana"
	@echo ""
	@echo "Scrape state (backend reachable?):"
	@curl -s http://localhost:9090/api/v1/targets 2>/dev/null | grep -o '"health":"[^"]*"' | head -3 || echo "  (Prometheus not reachable)"
	@echo ""
	@echo "Active alerts:"
	@curl -s http://localhost:9093/api/v2/alerts 2>/dev/null | python -c "import json,sys; alerts=json.load(sys.stdin); print(f'  {len(alerts)} firing') if alerts else print('  (none)')" 2>/dev/null || echo "  (Alertmanager not reachable)"

# Tail logs of all obs containers
obs-logs:
	docker compose --profile obs logs -f --tail=50

# Reload Prometheus + Alertmanager configs without restart (after editing YAML)
obs-reload:
	@echo "Reloading Prometheus config..."
	@curl -X POST http://localhost:9090/-/reload && echo "  ok"
	@echo "Reloading Alertmanager config..."
	@curl -X POST http://localhost:9093/-/reload && echo "  ok"

# Verify the backend /metrics endpoint exposes Graylinx custom metrics
obs-curl-metrics:
	@echo "Custom Graylinx metrics:"
	@curl -s http://localhost:8000/metrics | grep -E "^graylinx_" || echo "  (none — is the backend running?)"

# Fire a synthetic alert to verify the Alertmanager pipeline end-to-end
obs-test-alert:
	@echo "Sending synthetic test alert to Alertmanager..."
	@curl -X POST http://localhost:9093/api/v2/alerts \
	  -H "Content-Type: application/json" \
	  -d '[{"labels":{"alertname":"TestAlert","severity":"warning","job":"thermynx-api"},"annotations":{"summary":"Test alert from `make obs-test-alert`","description":"If you see this in Alertmanager UI, the pipeline works."}}]'
	@echo ""
	@echo "  → Open http://localhost:9093 to verify it appears"

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
