import stripe
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, auth, comments, patron, patrons, pledges, tasks, webhooks


def create_app() -> FastAPI:
    app = FastAPI(title="CoinOperatedBrandon", version="0.1.0")
    stripe.api_key = settings.stripe_secret_key

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    root = APIRouter(prefix=settings.base_path)
    root.include_router(admin.router)
    root.include_router(auth.router)
    root.include_router(patron.router)
    root.include_router(patrons.router)
    root.include_router(tasks.router)
    root.include_router(pledges.router)
    root.include_router(comments.router)
    root.include_router(webhooks.router)

    @root.get("/api/health")
    async def health_check():
        return {"status": "ok"}

    @root.get("/api/config/stripe")
    async def stripe_config():
        return {"publishable_key": settings.stripe_publishable_key}

    app.include_router(root)

    return app


app = create_app()
