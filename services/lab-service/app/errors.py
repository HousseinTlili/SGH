from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

REASONS = {
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    409: "Conflict", 422: "Unprocessable Entity", 503: "Service Unavailable",
}


class ApiError(Exception):
    def __init__(self, status: int, message: str, details: list | None = None):
        self.status = status
        self.message = message
        self.details = details


def _body(request: Request, status: int, message: str, details=None) -> dict:
    body = {
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "status": status,
        "error": REASONS.get(status, "Error"),
        "message": message,
        "path": request.url.path,
        "correlationId": getattr(request.state, "correlation_id", None),
    }
    if details:
        body["details"] = details
    return body


def _json(request, status, message, details=None):
    return JSONResponse(status_code=status, content=_body(request, status, message, details))


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(request: Request, exc: ApiError):
        return _json(request, exc.status, exc.message, exc.details)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return _json(request, exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        details = [
            {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "problem": e["msg"]}
            for e in exc.errors()
        ]
        return _json(request, 422, "Validation failed", details)

    @app.exception_handler(OperationalError)
    async def db_error(request: Request, exc: OperationalError):
        return _json(request, 503, "Database unavailable")