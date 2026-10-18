import uuid

from fastapi import FastAPI, Request

app = FastAPI(
    title="SGH Lab service",
    version="1.0.0",
    description="Service 4 (port 8084): lab requests, results, validation.",
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    # Reprend X-Correlation-Id s'il existe, sinon en génère un, puis le renvoie
    correlation_id = request.headers.get("X-Correlation-Id") or uuid.uuid4().hex[:8]
    request.state.correlation_id = correlation_id
    response = await call_next(request)
    response.headers["X-Correlation-Id"] = correlation_id
    return response


@app.get("/health", tags=["health"])
async def health():
    # Ne touche jamais à la base ni à RabbitMQ (règle X-6 / X-8)
    return {"status": "UP"}