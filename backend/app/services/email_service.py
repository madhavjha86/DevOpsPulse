"""Email delivery service with SMTP integration and configuration status checks."""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for dispatching transactional emails via configurable SMTP."""

    @classmethod
    def is_smtp_configured(cls) -> bool:
        """Return True only if an SMTP server host is explicitly configured."""
        settings = get_settings()
        return bool(settings.SMTP_HOST and settings.SMTP_HOST.strip())

    @classmethod
    def send_invitation_email(
        cls,
        to_email: str,
        org_name: str,
        role: str,
        inviter_name: str,
        invite_url: str,
        expires_hours: int = 48,
    ) -> tuple[bool, str]:
        """Dispatch organization invitation email.

        Returns (success: bool, status_code_or_reason: str).
        When SMTP is not configured, returns (False, 'EMAIL_NOT_CONFIGURED').
        """
        settings = get_settings()

        if not cls.is_smtp_configured():
            logger.info(
                "SMTP host not configured. Skipping invitation email dispatch to %s (Status: EMAIL_NOT_CONFIGURED)",
                to_email,
            )
            return False, "EMAIL_NOT_CONFIGURED"

        role_display = role.replace("_", " ").title()
        subject = f"You're invited to join {org_name} on {settings.APP_NAME}"

        plain_text = (
            f"Hello,\n\n"
            f"{inviter_name} has invited you to join the workspace '{org_name}' "
            f"as a {role_display} on {settings.APP_NAME}.\n\n"
            f"To accept this invitation and set up your account, visit the link below:\n"
            f"{invite_url}\n\n"
            f"This invitation link expires in {expires_hours} hours.\n\n"
            f"Best regards,\nThe {settings.APP_NAME} Team"
        )

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }}
    .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .logo {{ font-size: 20px; font-weight: 800; color: #7c3aed; margin-bottom: 24px; }}
    .title {{ font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }}
    .badge {{ display: inline-block; background-color: #f3e8ff; color: #7e22ce; padding: 4px 10px; border-radius: 8px; font-weight: 600; font-size: 13px; margin: 4px 0; }}
    .btn {{ display: inline-block; background-color: #7c3aed; color: #ffffff !important; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 24px 0; }}
    .footer {{ font-size: 12px; color: #64748b; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">{settings.APP_NAME}</div>
    <div class="title">Join {org_name}</div>
    <p><strong>{inviter_name}</strong> has invited you to collaborate in the workspace <strong>{org_name}</strong>.</p>
    <p>Your assigned role: <span class="badge">{role_display}</span></p>
    <p>Click the button below to accept your invitation and configure your account password:</p>
    <a href="{invite_url}" class="btn" target="_blank">Accept Invitation & Get Started</a>
    <p style="font-size: 12px; color: #64748b;">Or paste this URL into your browser:<br><code style="word-break: break-all; color: #7c3aed;">{invite_url}</code></p>
    <div class="footer">
      This single-use invitation link expires in {expires_hours} hours.<br>
      If you did not expect this invitation, you can safely ignore this email.
    </div>
  </div>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        server = None
        try:
            if settings.SMTP_SSL:
                server = smtplib.SMTP_SSL(
                    settings.SMTP_HOST,
                    settings.SMTP_PORT,
                    timeout=settings.SMTP_TIMEOUT_SECONDS,
                )
            else:
                server = smtplib.SMTP(
                    settings.SMTP_HOST,
                    settings.SMTP_PORT,
                    timeout=settings.SMTP_TIMEOUT_SECONDS,
                )
                if settings.SMTP_TLS:
                    server.starttls()

            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)

            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
            logger.info("Successfully dispatched invitation email to %s via SMTP", to_email)
            return True, "SENT"
        except Exception as exc:
            logger.warning("SMTP email dispatch failed to %s: %s", to_email, str(exc))
            return False, f"FAILED: {exc.__class__.__name__}"
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass
