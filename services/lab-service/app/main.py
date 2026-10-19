import asyncio
import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import swagger_ui_bundle
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app import database, events
from app.routers import docs, health, lab_requests, lab_results, tests

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("lab-service")

ERROR_TITLES = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    409: "Conflict",
    413: "Payload Too Large",
    422: "Unprocessable Entity",
    500: "Internal Server Error",
    503: "Service Unavailable",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # X-6: the HTTP server starts first; the database and the broker are connected in the background.
    tasks = []
    if os.getenv("TESTING") != "1":
        tasks = [
            asyncio.create_task(database.connect_and_init_db()),
            asyncio.create_task(events.consumer_loop()),
            asyncio.create_task(events.publisher_loop()),
        ]
    yield
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    database.engine.dispose()


app = FastAPI(
    title="SGH Lab service",
    version="1.0.0",
    docs_url=None,  # served by /docs below from local assets, not a CDN
    redoc_url=None,
    openapi_url=None,  # /openapi.json is the committed contract (routers/docs.py)
    lifespan=lifespan,
)


def error_body(request: Request, status: int, message: str, details=None) -> dict:
    body = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "status": status,
        "error": ERROR_TITLES.get(status, "Error"),
        "message": message,
        "path": request.url.path,
        "correlationId": getattr(request.state, "correlation_id", "unknown"),
    }
    if details:
        body["details"] = details
    return body


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """Reads or creates X-Correlation-Id and logs one line per request (method, path, status, duration, user)."""

    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())[:8]
        request.state.correlation_id = correlation_id
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Correlation-Id"] = correlation_id
        logger.info(
            "%s %s -> %d in %d ms correlationId=%s user=%s",
            request.method,
            request.url.path,
            response.status_code,
            (time.perf_counter() - started) * 1000,
            correlation_id,
            getattr(request.state, "username", "anonymous"),
        )
        return response


class DbReadyMiddleware(BaseHTTPMiddleware):
    """X-8: data endpoints answer 503 until migrations and seed have run; /health and /docs never wait."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/") and not database.db_ready:
            return JSONResponse(status_code=503, content=error_body(request, 503, "Database unavailable"))
        return await call_next(request)


# Added last = outermost: the correlation id exists before anything else runs.
app.add_middleware(DbReadyMiddleware)
app.add_middleware(CorrelationIdMiddleware)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    details = None
    message = str(exc.detail)
    if isinstance(exc.detail, list):
        details, message = exc.detail, "Validation failed"
    if exc.status_code == 404 and message == "Not Found":
        message = f"No route for {request.method} {request.url.path}"
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(request, exc.status_code, message, details),
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    problems = [
        {
            "field": ".".join(str(part) for part in err.get("loc", ()) if part not in ("body", "query", "path")) or "body",
            "problem": err.get("msg", "Invalid value"),
        }
        for err in exc.errors()
    ]
    locations = {err["loc"][0] for err in exc.errors() if err.get("loc")}
    malformed_json = any(err.get("type") == "json_invalid" for err in exc.errors())
    # Malformed JSON and parameters of the wrong type are 400; field validation of a valid body is 422.
    if malformed_json:
        return JSONResponse(status_code=400, content=error_body(request, 400, "Malformed request body"))
    if locations & {"path", "query"} and "body" not in locations:
        return JSONResponse(status_code=400, content=error_body(request, 400, "Invalid request parameter", problems))
    return JSONResponse(status_code=422, content=error_body(request, 422, "Validation failed", problems))


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError):
    if database.is_database_down(exc):
        logger.warning("Database unavailable while handling %s: %s", request.url.path, exc.__class__.__name__)
        return JSONResponse(status_code=503, content=error_body(request, 503, "Database unavailable"))
    logger.exception("Database error on %s", request.url.path)
    return JSONResponse(status_code=500, content=error_body(request, 500, "Internal server error"))


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    # The cause goes to the log only, never to the client.
    logger.exception("Unhandled exception on %s", request.url.path)
    return JSONResponse(status_code=500, content=error_body(request, 500, "Internal server error"))


# Swagger UI from the bundled assets, so /docs works without internet access.
app.mount("/docs-assets", StaticFiles(directory=swagger_ui_bundle.swagger_ui_path), name="docs-assets")


@app.get("/docs", include_in_schema=False)
def swagger_ui() -> HTMLResponse:
    return HTMLResponse(
        """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>SGH Lab service - API docs</title>
<link rel="stylesheet" href="/docs-assets/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="/docs-assets/swagger-ui-bundle.js"></script>
<script>window.ui = SwaggerUIBundle({url: "/openapi.json", dom_id: "#swagger-ui"});</script>
</body></html>"""
    )


app.include_router(health.router)
app.include_router(docs.router)
app.include_router(tests.router)
app.include_router(lab_requests.router)
app.include_router(lab_results.router)
