import logging
import sys
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, SQLAlchemyError

import app.models  # noqa: F401  (registers tables)
from app.config import settings
from contextlib import asynccontextmanager
from app.db import Base, SessionLocal, engine, check_database
from app.models import Hospital, User, Doctor
from app.security import hash_password

from app.routers import abdm, admin, ayush, fhir, health_monitoring, identifiers, auth, clinical_extraction, clinical_history, doctor_workflow, documents, patient_otp, protected
from app.services.ocr_service import available_engines

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("jivsetu")

problems = settings.validate_for_runtime()
if problems:
    for problem in problems:
        logger.error("configuration: %s", problem)
    if settings.is_production:
        raise RuntimeError("Refusing to start with insecure production configuration.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist and default hospital is created
    try:
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            hospital = db.query(Hospital).filter_by(hospital_code=settings.default_hospital_code).first()
            if not hospital:
                hospital = Hospital(
                    hospital_code=settings.default_hospital_code,
                    name="Janseva District Government Hospital",
                    name_hi="जनसेवा जिला सरकारी अस्पताल",
                    name_mr="जनसेवा जिल्हा सरकारी रुग्णालय",
                )
                db.add(hospital)
                db.commit()

            # Ensure default doctor account exists
            doctor_user = db.query(User).filter_by(user_code="dr-mehta").first()
            if not doctor_user:
                doctor_user = User(
                    user_code="dr-mehta",
                    password_hash=hash_password("Doctor@12345"),
                    role="doctor",
                    hospital_id=hospital.id,
                    is_active=True,
                )
                db.add(doctor_user)
                db.flush()
                db.add(Doctor(user_id=doctor_user.id, full_name="Dr. Mehta", hospital_id=hospital.id))
                db.commit()
                logger.info("Default doctor account created: dr-mehta")

            # Ensure default admin account exists
            admin_user = db.query(User).filter_by(user_code="admin").first()
            if not admin_user:
                admin_user = User(
                    user_code="admin",
                    password_hash=hash_password("Admin@12345"),
                    role="admin",
                    hospital_id=hospital.id,
                    is_active=True,
                )
                db.add(admin_user)
                db.commit()
                logger.info("Default admin account created: admin")

        logger.info("Database schema and staff accounts verified.")
    except Exception as e:
        logger.error(f"Failed to auto-initialize DB schema: {e}")
    yield

app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,  # bearer tokens, no cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    errors = [
        {"field": ".".join(str(p) for p in e.get("loc", [])[1:]), "message": e.get("msg", "Invalid value")}
        for e in exc.errors()
    ]
    first = errors[0]["message"].removeprefix("Value error, ") if errors else "Invalid request."
    return JSONResponse(status_code=422, content={"detail": first, "errors": errors})


@app.exception_handler(OperationalError)
async def db_unavailable_handler(_request: Request, exc: OperationalError):
    logger.error("database unavailable: %s", type(exc.orig).__name__ if exc.orig else type(exc).__name__)
    return JSONResponse(status_code=503, content={"detail": "The database is temporarily unavailable. Please try again shortly."})


@app.exception_handler(SQLAlchemyError)
async def db_error_handler(_request: Request, exc: SQLAlchemyError):
    ref = uuid.uuid4().hex[:8]
    logger.exception("database error ref=%s", ref, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": f"A database error occurred (ref {ref}).", "ref": ref})


@app.exception_handler(Exception)
async def unhandled_handler(_request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        raise exc
    ref = uuid.uuid4().hex[:8]
    logger.exception("unhandled error ref=%s", ref, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": f"Something went wrong (ref {ref}).", "ref": ref})


@app.get("/health", tags=["Health"])
def health():
    """Liveness: process is up. Includes dependency status without secrets."""
    db_ok, db_state = check_database()
    return {
        "status": "ok" if db_ok else "degraded",
        "service": "jivsetu-api",
        "environment": settings.environment,
        "database": {"backend": settings.database_backend, "status": db_state},
        "otp_provider": settings.otp_provider,
        "ocr": available_engines(),
        "demo_mode": settings.demo_mode,
    }


@app.get("/health/ready", tags=["Health"])
def ready():
    db_ok, db_state = check_database()
    if not db_ok:
        return JSONResponse(status_code=503, content={"status": "unavailable", "database": db_state})
    return {"status": "ready"}


app.include_router(auth.router)
app.include_router(protected.router)
app.include_router(patient_otp.router)
app.include_router(patient_otp.patient_router)
app.include_router(documents.router)
app.include_router(clinical_extraction.router)
app.include_router(doctor_workflow.router)
app.include_router(clinical_history.router)
app.include_router(admin.router)
app.include_router(fhir.router)
app.include_router(ayush.router)
app.include_router(identifiers.router)
app.include_router(abdm.router)
app.include_router(health_monitoring.router)
