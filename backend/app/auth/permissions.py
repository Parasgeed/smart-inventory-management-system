from fastapi import HTTPException, status

def admin_required(current_user):
    # Check by role name, not by magic primary key value.
    # Requires User.role relationship to be loaded (it is — SQLAlchemy
    # lazy-loads it on first access within the same db session).
    if not current_user.role or current_user.role.name.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required."
        )

    return current_user