from fastapi import APIRouter, Depends

from sqlalchemy.orm import Session

from ..database import get_db

from ..schemas.user import (
    UserResponse,
    ProfileUpdate
)

from ..utils.deps import get_current_user


router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)


@router.get(
    "/profile",
    response_model=UserResponse
)
def profile(
    current_user=Depends(
        get_current_user
    )
):

    return current_user


@router.put(
    "/profile",
    response_model=UserResponse
)
def update_profile(
    data: ProfileUpdate,
    current_user=Depends(
        get_current_user
    ),
    db: Session = Depends(get_db)
):

    values = data.model_dump(
        exclude_unset=True
    )

    for field, value in values.items():

        setattr(
            current_user,
            field,
            value
        )

    db.commit()

    db.refresh(current_user)

    return current_user