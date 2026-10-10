from pydantic import BaseModel


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    display_name: str | None = None
    expires_in: int


class ProtectedResponse(BaseModel):
    message: str
    user_id: str
    role: str
