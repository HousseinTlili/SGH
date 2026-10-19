from fastapi import APIRouter, Depends
from app.auth import require_roles

router = APIRouter(prefix="/api/_stub", tags=["stub"])

@router.get("/ping", dependencies=[Depends(require_roles(["ADMIN"]))])
def stub_ping():
    return {"status": "pong"}
