import stripe
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, auth, tasks


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

    app.include_router(admin.router)
    app.include_router(auth.router)
    app.include_router(tasks.router)

    @app.get("/api/health")
    async def health_check():
        return {"status": "ok"}

    return app


app = create_app()
