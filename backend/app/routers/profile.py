from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from ..database import get_db

from ..utils.deps import get_current_user

from ..schemas.user import (
    ProfileUpdate,
    UserResponse
)


router = APIRouter(
    prefix="/api/profile",
    tags=["Profile"]
)


# ============================================================
# GET CURRENT PROFILE
# ============================================================

@router.get(
    "",
    response_model=UserResponse
)
def get_profile(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    return user


# ============================================================
# UPDATE PROFILE
# ============================================================

@router.put(
    "",
    response_model=UserResponse
)
def update_profile(
    data: ProfileUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):

    update_data = data.model_dump(
        exclude_unset=True
    )

    # ========================================================
    # VALIDATE ROLE PREFERENCE
    # ========================================================

    if "role_preference" in update_data:

        allowed_roles = [
            "student",
            "working_professional",
            "developer",
            "manager",
            "homemaker",
            "other"
        ]

        selected_role = update_data[
            "role_preference"
        ]

        if selected_role not in allowed_roles:

            raise HTTPException(
                status_code=400,
                detail="Invalid role preference."
            )

    # ========================================================
    # UPDATE USER
    # ========================================================

    for key, value in update_data.items():

        if hasattr(user, key):

            setattr(
                user,
                key,
                value
            )

    db.commit()

    db.refresh(user)

    return user