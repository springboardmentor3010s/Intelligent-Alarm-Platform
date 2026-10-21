from pwdlib import PasswordHash
import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# -----------------------------
# Password Hashing
# -----------------------------

password_hash = PasswordHash.recommended()


# -----------------------------
# JWT Configuration
# -----------------------------

SECRET_KEY = "cognitive-alarm-secret-key"
ALGORITHM = "HS256"


# -----------------------------
# Bearer Token
# -----------------------------

security = HTTPBearer()


# -----------------------------
# Password Functions
# -----------------------------

def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


# -----------------------------
# Create JWT Token
# -----------------------------

def create_access_token(data: dict) -> str:
    return jwt.encode(
        data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )


# -----------------------------
# Get Current User from JWT
# -----------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"JWT Error: {str(e)}"
        )


# -----------------------------
# Role-Based Access
# -----------------------------

def require_roles(allowed_roles: list):
    def role_checker(
        current_user: dict = Depends(get_current_user)
    ):
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Requires one of roles: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker


def require_role(required_role: str):
    return require_roles([required_role])
