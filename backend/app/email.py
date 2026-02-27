import logging
from email.message import EmailMessage

import aiosmtplib

from app.config import settings

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email. Never raises — returns True on success, False on failure."""
    try:
        if not settings.smtp_host:
            logger.info("Email (dev no-op) to=%s subject=%r", to, subject)
            logger.info("Body:\n%s", body)
            return True

        msg = EmailMessage()
        msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.set_content(body)

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user or None,
            password=settings.smtp_password or None,
            start_tls=settings.smtp_use_tls,
        )
        return True
    except Exception:
        logger.exception("Failed to send email to=%s subject=%r", to, subject)
        return False
