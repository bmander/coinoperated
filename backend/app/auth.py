import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import stripe


def create_jwt(patron_id: uuid.UUID, secret_key: str, expiry_days: int) -> str:
    payload = {
        "sub": str(patron_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=expiry_days),
    }
    return jwt.encode(payload, secret_key, algorithm="HS256")


def decode_jwt(token: str, secret_key: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        return uuid.UUID(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None


def generate_magic_token() -> str:
    return secrets.token_urlsafe()


async def send_magic_link(email: str, link: str) -> None:
    from app.email import send_email

    subject = "Your sign-in link for CoinOperated"
    body = f"Click the link below to sign in:\n\n{link}\n\nThis link expires in 15 minutes."
    await send_email(email, subject, body)


def create_stripe_customer(email: str) -> str:
    customer = stripe.Customer.create(email=email)
    return customer.id
