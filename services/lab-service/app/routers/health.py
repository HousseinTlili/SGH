from fastapi import APIRouter
from app.schemas import Health

router = APIRouter(tags=["health"])

@router.get("/health", response_model=Health)
def health():
    return Health(status="UP")
