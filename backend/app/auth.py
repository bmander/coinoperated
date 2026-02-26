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


def send_magic_link(email: str, link: str) -> None:
    print(f"\n{'='*60}")
    print(f"Magic link for {email}:")
    print(f"  {link}")
    print(f"{'='*60}\n")


def create_stripe_customer(email: str) -> str:
    customer = stripe.Customer.create(email=email)
    return customer.id
