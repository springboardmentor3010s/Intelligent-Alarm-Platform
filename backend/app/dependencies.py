from datetime import datetime, timezone, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId
from .database import users, user_activity
from .security import decode_token

bearer = HTTPBearer()
ist = timezone(timedelta(hours=5, minutes=30))

def record_user_activity(user_id_str: str, activity_type: str = "active"):
    try:
        now_utc = datetime.now(timezone.utc)
        day_str = now_utc.astimezone(ist).strftime("%Y-%m-%d")
        user_activity.update_one(
            {"user_id": user_id_str, "date": day_str},
            {
                "$set": {
                    "last_active": now_utc,
                    "activity_type": activity_type,
                    "date": day_str
                },
                "$setOnInsert": {
                    "user_id": user_id_str,
                    "created_at": now_utc
                }
            },
            upsert=True
        )
        users.update_one(
            {"_id": ObjectId(user_id_str)},
            {"$set": {"last_active": now_utc, "last_active_date": day_str}}
        )
    except Exception:
        pass

def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    payload = decode_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    record_user_activity(str(user["_id"]))
    return user

def require_roles(*roles):
    def checker(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return checker

def require_user(user=Depends(current_user)):
    return user

def require_wellness_coach(user=Depends(require_roles("WELLNESS_COACH", "ADMIN"))):
    return user

def require_admin(user=Depends(require_roles("ADMIN"))):
    return user

