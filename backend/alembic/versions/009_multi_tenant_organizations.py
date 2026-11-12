"""Add multi-tenant organizations, memberships, invitations and workspace scoping.

Revision ID: 009_multi_tenant_orgs
Revises: 008_v1_1_features
Create Date: 2026-11-12 21:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column, select

revision: str = "009_multi_tenant_orgs"
down_revision: Union[str, None] = "008_v1_1_features"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("slug", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=20), server_default="COMPANY", nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index("ix_organizations_type", "organizations", ["type"])
    op.create_index("ix_organizations_owner_id", "organizations", ["owner_id"])
    op.create_index("ix_organizations_type_owner", "organizations", ["type", "owner_id"])

    # 2. Create organization_members table
    op.create_table(
        "organization_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=50), server_default="DEVELOPER", nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_org_member_org_id", "organization_members", ["organization_id"])
    op.create_index("ix_org_member_user_id", "organization_members", ["user_id"])
    op.create_index("ix_org_member_role", "organization_members", ["organization_id", "role"])
    op.create_index("ix_org_member_unique", "organization_members", ["organization_id", "user_id"], unique=True)

    # 3. Create organization_invitations table
    op.create_table(
        "organization_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("organization_id", sa.Integer(), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), server_default="DEVELOPER", nullable=False),
        sa.Column("token", sa.String(length=100), nullable=False),
        sa.Column("invited_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="PENDING", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_org_invitations_token", "organization_invitations", ["token"], unique=True)
    op.create_index("ix_org_invitations_org_id", "organization_invitations", ["organization_id"])
    op.create_index("ix_org_invitations_email", "organization_invitations", ["email"])
    op.create_index("ix_org_invitations_status", "organization_invitations", ["status"])

    # 4. Add organization_id column to existing scoped tables
    scoped_tables = [
        "repositories",
        "incidents",
        "cloud_accounts",
        "cloud_budgets",
        "cloud_cost_items",
        "cloud_cost_optimizations",
        "docker_hosts",
        "k8s_clusters",
        "engineering_teams",
        "telemetry_logs",
        "telemetry_spans",
        "ai_conversations",
        "ai_root_cause_analyses",
        "ai_pr_reviews",
        "ai_failure_predictions",
        "audit_logs",
    ]

    for tbl in scoped_tables:
        op.add_column(
            tbl,
            sa.Column(
                "organization_id",
                sa.Integer(),
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.create_index(f"ix_{tbl}_organization_id", tbl, ["organization_id"])

    # 5. Data backfill: Create Personal Workspace for all existing users and link existing data
    conn = op.get_bind()
    users_table = table(
        "users",
        column("id", sa.Integer),
        column("username", sa.String),
        column("full_name", sa.String),
    )
    orgs_table = table(
        "organizations",
        column("id", sa.Integer),
        column("name", sa.String),
        column("slug", sa.String),
        column("type", sa.String),
        column("owner_id", sa.Integer),
        column("is_active", sa.Boolean),
    )
    members_table = table(
        "organization_members",
        column("organization_id", sa.Integer),
        column("user_id", sa.Integer),
        column("role", sa.String),
    )

    users = conn.execute(select(users_table.c.id, users_table.c.username, users_table.c.full_name)).fetchall()

    for user_id, username, full_name in users:
        org_name = f"{full_name or username}'s Personal Workspace"
        org_slug = f"personal-{user_id}"

        # Insert personal organization
        ins_org = conn.execute(
            sa.text(
                "INSERT INTO organizations (name, slug, type, owner_id, is_active, created_at, updated_at) "
                "VALUES (:name, :slug, 'PERSONAL', :owner_id, true, NOW(), NOW()) RETURNING id"
            ),
            {"name": org_name, "slug": org_slug, "owner_id": user_id},
        )
        org_id = ins_org.scalar()

        # Add user as ORGANIZATION_ADMIN of their personal workspace
        conn.execute(
            sa.text(
                "INSERT INTO organization_members (organization_id, user_id, role, joined_at, created_at, updated_at) "
                "VALUES (:org_id, :user_id, 'ORGANIZATION_ADMIN', NOW(), NOW(), NOW())"
            ),
            {"org_id": org_id, "user_id": user_id},
        )

        # Backfill existing records for this user to their personal organization
        # 1. repositories links through github_accounts
        conn.execute(
            sa.text(
                "UPDATE repositories SET organization_id = :org_id "
                "WHERE (github_account_id IN (SELECT id FROM github_accounts WHERE user_id = :user_id) "
                "OR github_account_id IS NULL) AND organization_id IS NULL"
            ),
            {"org_id": org_id, "user_id": user_id},
        )

        # 2. Other scoped tables having direct user_id
        direct_user_tables = [
            "incidents",
            "cloud_accounts",
            "cloud_budgets",
            "cloud_cost_items",
            "cloud_cost_optimizations",
            "docker_hosts",
            "k8s_clusters",
            "engineering_teams",
            "telemetry_logs",
            "telemetry_spans",
            "ai_conversations",
            "ai_root_cause_analyses",
            "ai_pr_reviews",
            "ai_failure_predictions",
            "audit_logs",
        ]
        for tbl in direct_user_tables:
            conn.execute(
                sa.text(f"UPDATE {tbl} SET organization_id = :org_id WHERE user_id = :user_id AND organization_id IS NULL"),
                {"org_id": org_id, "user_id": user_id},
            )


def downgrade() -> None:
    scoped_tables = [
        "repositories",
        "incidents",
        "cloud_accounts",
        "cloud_budgets",
        "cloud_cost_items",
        "cloud_cost_optimizations",
        "docker_hosts",
        "k8s_clusters",
        "engineering_teams",
        "telemetry_logs",
        "telemetry_spans",
        "ai_conversations",
        "ai_root_cause_analyses",
        "ai_pr_reviews",
        "ai_failure_predictions",
        "audit_logs",
    ]

    for tbl in scoped_tables:
        op.drop_index(f"ix_{tbl}_organization_id", table_name=tbl)
        op.drop_column(tbl, "organization_id")

    op.drop_table("organization_invitations")
    op.drop_table("organization_members")
    op.drop_table("organizations")
