"""Supply-chain ERP — Phase 2 (Vendors, Inventory, Procurement).

Revision ID: 0010
Revises: 0009

vendors, parts, part_stock, purchase_orders, purchase_order_lines,
purchase_order_events, wo_parts.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vendors",
        sa.Column("id",             sa.String(36), primary_key=True),
        sa.Column("name",           sa.String(128), nullable=False),
        sa.Column("contact",        sa.String(128)),
        sa.Column("email",          sa.String(128)),
        sa.Column("lead_time_days", sa.Integer),
        sa.Column("rating",         sa.Float),
        sa.Column("active",         sa.Integer, server_default="1"),
        sa.Column("notes",          sa.Text),
        sa.Column("created_at",     sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "parts",
        sa.Column("id",            sa.String(36), primary_key=True),
        sa.Column("code",          sa.String(64), nullable=False, index=True),
        sa.Column("name",          sa.String(256), nullable=False),
        sa.Column("vendor_id",     sa.String(36), sa.ForeignKey("vendors.id", ondelete="SET NULL")),
        sa.Column("unit_cost",     sa.Float),
        sa.Column("uom",           sa.String(16), server_default="ea"),
        sa.Column("reorder_point", sa.Integer, server_default="0"),
        sa.Column("reorder_qty",   sa.Integer, server_default="0"),
        sa.Column("active",        sa.Integer, server_default="1"),
        sa.Column("created_at",    sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "part_stock",
        sa.Column("id",           sa.String(36), primary_key=True),
        sa.Column("part_id",      sa.String(36), sa.ForeignKey("parts.id", ondelete="CASCADE"), index=True),
        sa.Column("location",     sa.String(64), server_default="main"),
        sa.Column("qty_on_hand",  sa.Float, server_default="0"),
        sa.Column("qty_reserved", sa.Float, server_default="0"),
        sa.Column("updated_at",   sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "purchase_orders",
        sa.Column("id",          sa.String(36), primary_key=True),
        sa.Column("vendor_id",   sa.String(36), sa.ForeignKey("vendors.id", ondelete="SET NULL"), index=True),
        sa.Column("state",       sa.String(16), server_default="draft", index=True),
        sa.Column("total_cost",  sa.Float, server_default="0"),
        sa.Column("created_by",  sa.String(64)),
        sa.Column("expected_at", sa.DateTime),
        sa.Column("received_at", sa.DateTime),
        sa.Column("notes",       sa.Text),
        sa.Column("created_at",  sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at",  sa.DateTime, server_default=sa.func.now()),
    )
    op.create_table(
        "purchase_order_lines",
        sa.Column("id",        sa.String(36), primary_key=True),
        sa.Column("po_id",     sa.String(36), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True),
        sa.Column("part_id",   sa.String(36), sa.ForeignKey("parts.id", ondelete="RESTRICT")),
        sa.Column("qty",       sa.Float, nullable=False),
        sa.Column("unit_cost", sa.Float),
    )
    op.create_table(
        "purchase_order_events",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("po_id",      sa.String(36), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), index=True),
        sa.Column("kind",       sa.String(24), nullable=False),
        sa.Column("from_state", sa.String(16)),
        sa.Column("to_state",   sa.String(16)),
        sa.Column("actor",      sa.String(64)),
        sa.Column("notes",      sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), index=True),
    )
    op.create_table(
        "wo_parts",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("wo_id",      sa.String(36), sa.ForeignKey("work_orders.id", ondelete="CASCADE"), index=True),
        sa.Column("part_id",    sa.String(36), sa.ForeignKey("parts.id", ondelete="RESTRICT")),
        sa.Column("qty_used",   sa.Float, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )


def downgrade() -> None:
    for t in ("wo_parts", "purchase_order_events", "purchase_order_lines",
              "purchase_orders", "part_stock", "parts", "vendors"):
        op.drop_table(t)
