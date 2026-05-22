"""Work Order management — tables for Phase WO.

Revision ID: 0004
Revises: 0003

Creates:
  technicians       — operator / maintenance person directory
  pm_templates      — recurring preventive-maintenance templates
  work_orders       — current-state work-order entity
  work_order_events — append-only audit trail of WO transitions + comments

Seeds a small default set of PM templates so the maintenance scheduler has
something to do on day one.
"""
from typing import Sequence, Union
import uuid

import sqlalchemy as sa
from alembic import op


revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "technicians",
        sa.Column("id",              sa.String(36),  primary_key=True),
        sa.Column("name",            sa.String(128), nullable=False),
        sa.Column("email",           sa.String(128)),
        sa.Column("skills",          sa.Text),
        sa.Column("location",        sa.String(64)),
        sa.Column("active",          sa.Integer, server_default="1"),
        sa.Column("success_rate",    sa.Float),
        sa.Column("open_assignments", sa.Integer, server_default="0"),
        sa.Column("notes",           sa.Text),
        sa.Column("created_at",      sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "pm_templates",
        sa.Column("id",             sa.String(36),  primary_key=True),
        sa.Column("name",           sa.String(128), nullable=False),
        sa.Column("equipment_type", sa.String(32),  nullable=False),
        sa.Column("interval_days",  sa.Integer,     nullable=False),
        sa.Column("priority",       sa.String(16),  server_default="normal"),
        sa.Column("description",    sa.Text),
        sa.Column("active",         sa.Integer,     server_default="1"),
        sa.Column("last_run_at",    sa.DateTime),
        sa.Column("created_at",     sa.DateTime,    server_default=sa.func.now()),
    )

    op.create_table(
        "work_orders",
        sa.Column("id",                  sa.String(36),  primary_key=True),
        sa.Column("equipment_id",        sa.String(64), index=True),
        sa.Column("title",               sa.String(256), nullable=False),
        sa.Column("description",         sa.Text),
        sa.Column("priority",            sa.String(16),  server_default="normal"),
        sa.Column("state",               sa.String(16),  server_default="open", index=True),
        sa.Column("source",              sa.String(32),  server_default="manual"),
        sa.Column("source_ref",          sa.String(64)),
        sa.Column("created_by",          sa.String(64)),
        sa.Column("assigned_to",         sa.String(36),  sa.ForeignKey("technicians.id", ondelete="SET NULL"), index=True),
        sa.Column("diagnosis",           sa.Text),
        sa.Column("recommended_actions", sa.Text),
        sa.Column("due_at",              sa.DateTime),
        sa.Column("resolved_at",         sa.DateTime),
        sa.Column("closed_at",           sa.DateTime),
        sa.Column("created_at",          sa.DateTime, server_default=sa.func.now(), index=True),
        sa.Column("updated_at",          sa.DateTime, server_default=sa.func.now()),
    )

    op.create_table(
        "work_order_events",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("wo_id",      sa.String(36), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), index=True),
        sa.Column("kind",       sa.String(24), nullable=False),
        sa.Column("from_state", sa.String(16)),
        sa.Column("to_state",   sa.String(16)),
        sa.Column("actor",      sa.String(64)),
        sa.Column("notes",      sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), index=True),
    )

    # ── Seed default PM templates drawn from the HVAC maintenance playbook ───
    pm_seeds = [
        ("Daily operator round",          "all",           1,   "low",      "Visual inspection of every equipment; record any abnormal sound or gauge reading."),
        ("Weekly tower fill inspection",  "cooling_tower", 7,   "normal",   "Visually inspect tower fill packs and spray nozzles; check basin level."),
        ("Weekly pump strainer check",    "pump",          7,   "low",      "Check pump strainer differential pressure; clean if ΔP > 2 psi."),
        ("Monthly chiller charge check",  "chiller",       30,  "normal",   "Verify refrigerant charge via sight glass under full load."),
        ("Quarterly vibration survey",    "all",           90,  "normal",   "Record overall mm/s velocity and dominant frequency on every motor; trend against previous quarter."),
        ("Annual eddy-current tube test", "chiller",       365, "high",     "Eddy-current test evaporator and condenser tubes; replace tubes flagged > 60% wall loss."),
        ("Annual tower fill cleaning",    "cooling_tower", 365, "normal",   "Pull fill packs for inspection / acid clean if approach has trended up."),
        ("Annual pump bearing inspection","pump",          365, "high",     "Vibration baseline + visual inspection of pump bearings."),
    ]
    op.bulk_insert(
        sa.table(
            "pm_templates",
            sa.column("id",             sa.String),
            sa.column("name",           sa.String),
            sa.column("equipment_type", sa.String),
            sa.column("interval_days",  sa.Integer),
            sa.column("priority",       sa.String),
            sa.column("description",    sa.Text),
            sa.column("active",         sa.Integer),
        ),
        [
            {
                "id": str(uuid.uuid4()),
                "name": name, "equipment_type": et, "interval_days": days,
                "priority": pri, "description": desc, "active": 1,
            }
            for (name, et, days, pri, desc) in pm_seeds
        ],
    )

    # ── Seed a small demo technician set so assignment screens aren't empty ──
    tech_seeds = [
        ("Ravi Kumar",     "ravi@example.com",     "chiller,vibration,refrigerant", "Plant Room A", 0.92),
        ("Suresh Iyer",    "suresh@example.com",   "tower,pump,water_chemistry",    "Plant Room B", 0.88),
        ("Anita Sharma",   "anita@example.com",    "vfd,electrical,controls",       "Control Room", 0.95),
        ("Priya Nair",     "priya@example.com",    "chiller,pm,inspection",         "Plant Room A", 0.86),
    ]
    op.bulk_insert(
        sa.table(
            "technicians",
            sa.column("id",            sa.String),
            sa.column("name",          sa.String),
            sa.column("email",         sa.String),
            sa.column("skills",        sa.Text),
            sa.column("location",      sa.String),
            sa.column("success_rate",  sa.Float),
            sa.column("active",        sa.Integer),
            sa.column("open_assignments", sa.Integer),
        ),
        [
            {
                "id": str(uuid.uuid4()),
                "name": n, "email": e, "skills": s, "location": loc,
                "success_rate": sr, "active": 1, "open_assignments": 0,
            }
            for (n, e, s, loc, sr) in tech_seeds
        ],
    )


def downgrade() -> None:
    op.drop_table("work_order_events")
    op.drop_table("work_orders")
    op.drop_table("pm_templates")
    op.drop_table("technicians")
