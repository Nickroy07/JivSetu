from fastapi import APIRouter, Depends
from app.schemas import ProtectedResponse
from app.security import get_current_user, require_roles

router = APIRouter(prefix="/protected", tags=["Authorization"])

@router.get("/me", response_model=ProtectedResponse)
def me(current_user=Depends(get_current_user)):
    return {"message": "Authenticated successfully.", "user_id": current_user["sub"], "role": current_user["role"]}

@router.get("/doctor-only")
def doctor_only(current_user=Depends(require_roles("doctor"))):
    return {"message": "Doctor-only endpoint.", "user_id": current_user["sub"]}

@router.get("/admin-only")
def admin_only(current_user=Depends(require_roles("admin"))):
    return {"message": "Admin-only endpoint.", "user_id": current_user["sub"]}
