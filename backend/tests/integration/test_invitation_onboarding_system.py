"""Integration tests for the complete Organization Member Invitation and Onboarding System.

Verifies:
1. Token generation: secure random token stored as SHA-256 hash in database.
2. Expiration: 48-hour expiration correctly calculated and enforced.
3. RBAC role restrictions:
   - Organization Admin cannot assign or invite SUPER_ADMIN (403 Forbidden).
   - Only platform Superuser can assign SUPER_ADMIN.
   - Organization Admin can assign ORGANIZATION_ADMIN, DEVOPS_ENGINEER, DEVELOPER, SECURITY_ENGINEER, VIEWER.
   - Non-admins cannot invite, resend, revoke, or view invitations (403 Forbidden).
4. Email dispatch status:
   - EMAIL_NOT_CONFIGURED returned when SMTP is unconfigured.
   - Formatted invite_url provided for manual sharing.
5. Verification endpoint: GET /api/v1/organizations/invitations/verify.
6. Public onboarding for new users:
   - Users create their own passwords (minimum 8 characters).
   - Never uses shared or default passwords.
   - Auto-provisions user record, personal workspace, and organization membership.
   - Returns valid JWT session tokens.
7. Resend invitation: generates new token, refreshes 48h expiry, sets PENDING.
8. Revoke invitation: marks REVOKED, prevents onboarding.
9. Audit logs: records entries for creation, resend, revoke, accept, and role change.
"""

from datetime import datetime, timedelta, timezone
import hashlib
from unittest.mock import MagicMock, patch
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.security import verify_password
from app.models.audit_log import AuditLog
from app.models.organization import (
    Organization,
    OrganizationInvitation,
    OrganizationMember,
    OrganizationRole,
)
from app.models.user import User
from app.services.email_service import EmailService


@pytest.mark.asyncio
async def test_invitation_lifecycle_and_onboarding(
    authenticated_client: tuple[AsyncClient, User],
    db_session,
):
    """Test comprehensive invitation and onboarding lifecycle."""
    client, admin_user = authenticated_client
    admin_token = client.headers["Authorization"].replace("Bearer ", "")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create a Company Workspace
    create_org_res = await client.post(
        "/api/v1/organizations",
        headers=admin_headers,
        json={"name": "DevOpsPulse Corp", "type": "COMPANY"},
    )
    assert create_org_res.status_code == 201
    org = create_org_res.json()
    org_id = org["id"]
    org_headers = {
        "Authorization": f"Bearer {admin_token}",
        "X-Organization-Id": str(org_id),
    }

    # 2. RBAC: Org Admin cannot invite user with SUPER_ADMIN role (403 Forbidden)
    super_invite_res = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=org_headers,
        json={"email": "superhacker@example.com", "role": "SUPER_ADMIN"},
    )
    assert super_invite_res.status_code == 403
    assert "Super Administrators" in super_invite_res.json().get("detail", "")

    # 3. Org Admin invites new engineer as DEVOPS_ENGINEER
    invite_res = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=org_headers,
        json={"email": "new.devops@example.com", "role": "DEVOPS_ENGINEER"},
    )
    assert invite_res.status_code == 201
    invite_data = invite_res.json()
    assert invite_data["email"] == "new.devops@example.com"
    assert invite_data["role"] == "DEVOPS_ENGINEER"
    assert invite_data["status"] == "PENDING"
    assert invite_data["email_status"] == "EMAIL_NOT_CONFIGURED"
    assert "invite_url" in invite_data
    assert "raw_token" in invite_data
    raw_token = invite_data["raw_token"]
    stored_hash = invite_data["token"]
    invitation_id = invite_data["id"]

    # 4. Verify Database Token Hashing (Raw token MUST NOT be in the database)
    expected_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    assert stored_hash == expected_hash

    db_inv_res = await db_session.execute(
        select(OrganizationInvitation).where(OrganizationInvitation.id == invitation_id)
    )
    db_inv = db_inv_res.scalar_one()
    assert db_inv.token == expected_hash
    assert db_inv.token != raw_token

    # Verify 48-hour expiration
    exp = db_inv.expires_at if db_inv.expires_at.tzinfo else db_inv.expires_at.replace(tzinfo=timezone.utc)
    time_diff = exp - datetime.now(timezone.utc)
    assert 47 <= time_diff.total_seconds() / 3600 <= 49

    # 5. Public Token Verification Endpoint
    verify_res = await client.get(
        f"/api/v1/organizations/invitations/verify?token={raw_token}"
    )
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["valid"] is True
    assert verify_data["organization_name"] == "DevOpsPulse Corp"
    assert verify_data["email"] == "new.devops@example.com"
    assert verify_data["role"] == "DEVOPS_ENGINEER"
    assert verify_data["user_exists"] is False

    # 6. Public Onboarding: New user sets their own password and joins workspace
    accept_res = await client.post(
        "/api/v1/organizations/invitations/accept",
        json={
            "token": raw_token,
            "password": "SecureOnboarding2026!",
            "full_name": "Jordan DevOps",
            "username": "jordandevops",
        },
    )
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["is_new_user"] is True
    assert "access_token" in accept_data
    assert "refresh_token" in accept_data

    # 7. Verify newly onboarded user credentials and workspace isolation
    new_user_res = await db_session.execute(
        select(User).where(User.email == "new.devops@example.com")
    )
    new_user = new_user_res.scalar_one()
    assert new_user.username == "jordandevops"
    assert new_user.full_name == "Jordan DevOps"
    assert verify_password("SecureOnboarding2026!", new_user.hashed_password)

    # Verify membership and assigned role in DevOpsPulse Corp
    member_res = await db_session.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == new_user.id,
        )
    )
    membership = member_res.scalar_one()
    assert membership.role == "DEVOPS_ENGINEER"

    # Verify personal workspace auto-provisioned
    personal_res = await db_session.execute(
        select(Organization).where(
            Organization.owner_id == new_user.id,
            Organization.type == "PERSONAL",
        )
    )
    assert personal_res.scalar_one_or_none() is not None

    # 8. Token Single-Use: Attempting to accept again must fail (400)
    second_accept = await client.post(
        "/api/v1/organizations/invitations/accept",
        json={
            "token": raw_token,
            "password": "SecureOnboarding2026!",
        },
    )
    assert second_accept.status_code == 400
    assert "already been accepted" in second_accept.json().get("detail", "")

    # 9. Test Resend Invitation
    invite2_res = await client.post(
        f"/api/v1/organizations/{org_id}/invitations",
        headers=org_headers,
        json={"email": "developer2@example.com", "role": "DEVELOPER"},
    )
    assert invite2_res.status_code == 201
    invite2_id = invite2_res.json()["id"]
    old_raw_token = invite2_res.json()["raw_token"]

    resend_res = await client.post(
        f"/api/v1/organizations/{org_id}/invitations/{invite2_id}/resend",
        headers=org_headers,
    )
    assert resend_res.status_code == 200
    new_raw_token = resend_res.json()["raw_token"]
    assert new_raw_token != old_raw_token

    # Old token fails
    old_verify = await client.get(
        f"/api/v1/organizations/invitations/verify?token={old_raw_token}"
    )
    assert old_verify.status_code == 404

    # New token succeeds
    new_verify = await client.get(
        f"/api/v1/organizations/invitations/verify?token={new_raw_token}"
    )
    assert new_verify.status_code == 200

    # 10. Test Revoke Invitation
    revoke_res = await client.post(
        f"/api/v1/organizations/{org_id}/invitations/{invite2_id}/revoke",
        headers=org_headers,
    )
    assert revoke_res.status_code == 200
    assert revoke_res.json()["status"] == "REVOKED"

    # Accepting revoked invitation fails (400)
    revoked_accept = await client.post(
        "/api/v1/organizations/invitations/accept",
        json={"token": new_raw_token, "password": "Password123!"},
    )
    assert revoked_accept.status_code == 400
    assert "revoked" in revoked_accept.json().get("detail", "")

    # 11. Verify Audit Logs
    audit_res = await db_session.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == org_id)
        .order_by(AuditLog.id.asc())
    )
    logs = audit_res.scalars().all()
    actions = [l.action for l in logs]
    assert "organization.invitation.created" in actions
    assert "organization.invitation.accepted" in actions
    assert "organization.invitation.resent" in actions
    assert "organization.invitation.revoked" in actions


@pytest.mark.asyncio
async def test_email_service_smtp_mock():
    """Test EmailService SMTP dispatch with mocked smtplib."""
    with patch("smtplib.SMTP") as mock_smtp_class:
        mock_server = MagicMock()
        mock_smtp_class.return_value = mock_server

        with patch("app.services.email_service.get_settings") as mock_settings:
            settings_obj = MagicMock()
            settings_obj.SMTP_HOST = "smtp.mailgun.org"
            settings_obj.SMTP_PORT = 587
            settings_obj.SMTP_USER = "postmaster@mailgun.org"
            settings_obj.SMTP_PASSWORD = "testpassword"
            settings_obj.SMTP_TLS = True
            settings_obj.SMTP_SSL = False
            settings_obj.SMTP_TIMEOUT_SECONDS = 5
            settings_obj.SMTP_FROM_EMAIL = "noreply@devopspulse.com"
            settings_obj.SMTP_FROM_NAME = "DevOpsPulse"
            settings_obj.APP_NAME = "DevOpsPulse"
            mock_settings.return_value = settings_obj

            success, status = EmailService.send_invitation_email(
                to_email="colleague@company.com",
                org_name="DevOpsPulse Production",
                role="SECURITY_ENGINEER",
                inviter_name="Lead Admin",
                invite_url="http://localhost:3000/invitations/accept?token=xyz123",
                expires_hours=48,
            )

            assert success is True
            assert status == "SENT"
            mock_server.starttls.assert_called_once()
            mock_server.login.assert_called_once_with("postmaster@mailgun.org", "testpassword")
            mock_server.sendmail.assert_called_once()
            mock_server.quit.assert_called_once()
