from fastapi import FastAPI

from app.config import settings
from app.routers import auth, db_test, protected, users

app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "jivsetu-security-api",
        "environment": settings.environment,
    }


app.include_router(auth.router)
app.include_router(protected.router)
app.include_router(db_test.router)
app.include_router(users.router)
