import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.amqp import start_consumer
from app.database import connect_and_init_db, db_ready
from app.routers import docs, health, lab_requests, lab_results, stub, tests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("lab-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    if os.getenv("TESTING") == "1":
        yield
        return
    # Background database initialization and RabbitMQ consumer
    db_task = asyncio.create_task(connect_and_init_db())
    consumer_task = asyncio.create_task(start_consumer())
    yield
    db_task.cancel()
    consumer_task.cancel()


app = FastAPI(
    title="SGH Lab service",
    version="1.0.0",
    docs_url="/docs",
    openapi_url=None,  # Handled by custom docs router returning contract openapi.yaml
    lifespan=lifespan
)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        corr_id = request.headers.get("X-Correlation-Id")
        if not corr_id:
            corr_id = str(uuid.uuid4())[:8]

        request.state.correlation_id = corr_id
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = corr_id
        return response


class DbReadyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        from app.database import db_ready as is_ready

        # Allow /health, /docs, /openapi.json through unconditionally (Rule X-8)
        path = request.url.path
        if path.startswith("/api/") and not is_ready:
            corr_id = getattr(request.state, "correlation_id", "unknown")
            return JSONResponse(
                status_code=503,
                content={
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "status": 503,
                    "error": "Service Unavailable",
                    "message": "Database unavailable",
                    "path": path,
                    "correlationId": corr_id
                }
            )
        return await call_next(request)


app.add_middleware(DbReadyMiddleware)
app.add_middleware(CorrelationIdMiddleware)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    corr_id = getattr(request.state, "correlation_id", "unknown")
    status_code = exc.status_code

    error_titles = {
        400: "Bad Request",
        401: "Unauthorized",
        403: "Forbidden",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
        503: "Service Unavailable"
    }

    error_title = error_titles.get(status_code, "Error")

    details = None
    if isinstance(exc.detail, list):
        details = exc.detail
        message = "Validation failed"
    else:
        message = str(exc.detail)

    content = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": status_code,
        "error": error_title,
        "message": message,
        "path": request.url.path,
        "correlationId": corr_id
    }
    if details:
        content["details"] = details

    return JSONResponse(status_code=status_code, content=content)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    corr_id = getattr(request.state, "correlation_id", "unknown")
    details = []
    for err in exc.errors():
        field = ".".join(str(loc) for loc in err.get("loc", []) if loc != "body")
        details.append({
            "field": field or "body",
            "problem": err.get("msg", "Invalid value")
        })

    return JSONResponse(
        status_code=422,
        content={
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": 422,
            "error": "Unprocessable Entity",
            "message": "Validation failed",
            "path": request.url.path,
            "correlationId": corr_id,
            "details": details
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    corr_id = getattr(request.state, "correlation_id", "unknown")
    logger.exception(f"Unhandled exception on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": 500,
            "error": "Internal Server Error",
            "message": str(exc) or "An unexpected error occurred",
            "path": request.url.path,
            "correlationId": corr_id
        }
    )


# Include routers
app.include_router(health.router)
app.include_router(stub.router)
app.include_router(docs.router)
app.include_router(tests.router)
app.include_router(lab_requests.router)
app.include_router(lab_results.router)
