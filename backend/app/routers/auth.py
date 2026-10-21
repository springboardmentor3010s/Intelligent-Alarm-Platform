from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status
)

from fastapi.security import OAuth2PasswordRequestForm

from sqlalchemy.orm import Session

from ..database import get_db
from ..models.login_event import LoginEvent
from ..models.user import User
from ..services.coach_assignment_service import ensure_user_has_coach

from ..schemas.user import (
    UserCreate,
    UserResponse
)

from ..utils.security import (
    hash_password,
    verify_password,
    create_access_token
)

from ..utils.deps import get_current_user


router = APIRouter()


# ============================================================
# REGISTER
# ============================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def register(
    data: UserCreate,
    db: Session = Depends(get_db)
):

    email = data.email.strip().lower()

    requested_role = (data.role or "user").strip().lower()
    if requested_role != "user":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Privileged roles must be assigned by an administrator",
        )

    # --------------------------------------------------------
    # CHECK EXISTING USER
    # --------------------------------------------------------

    existing_user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # --------------------------------------------------------
    # CREATE USER
    # --------------------------------------------------------

    user = User(
        name=data.name.strip(),

        email=email,

        password_hash=hash_password(
            data.password
        ),

        role="user",

        preferred_wake_time=data.preferred_wake_time,

        sleep_duration=data.sleep_duration,

        timezone=data.timezone,

        productivity_goal=data.productivity_goal,

        difficulty_preference=data.difficulty_preference,

        habit_preferences=data.habit_preferences,

        role_preference=data.role_preference
    )

    # --------------------------------------------------------
    # SAVE
    # --------------------------------------------------------

    db.add(user)
    db.flush()
    ensure_user_has_coach(db, user, assigned_by_id=None)
    db.commit()

    db.refresh(user)

    return user


# ============================================================
# LOGIN / TOKEN
# ============================================================

@router.post("/login")
@router.post("/token")
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    email = form.username.strip().lower()

    # --------------------------------------------------------
    # FIND USER
    # --------------------------------------------------------

    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    # --------------------------------------------------------
    # VERIFY
    # --------------------------------------------------------

    if not user:

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not verify_password(
        form.password,
        user.password_hash
    ):

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    db.add(LoginEvent(user_id=user.id))
    ensure_user_has_coach(db, user, assigned_by_id=None)
    db.commit()

    # --------------------------------------------------------
    # CREATE TOKEN
    # --------------------------------------------------------

    access_token = create_access_token(
        {
            "sub": str(user.id),
            "role": user.role
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",

        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


# ============================================================
# CURRENT USER
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse
)
def get_me(
    current_user=Depends(get_current_user)
):

    return current_user