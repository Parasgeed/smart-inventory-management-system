from sqlalchemy.orm import Session
from app.models.notification_model import Notification
from app.models.user_model import User

def create_notification_for_all_users(
    db: Session,
    type: str,
    title: str,
    message: str,
    reference_id: int = None
):
    """
    Creates a notification for all active users.
    """
    users = db.query(User).filter(User.is_active == True).all()
    notifications = []
    
    for user in users:
        notification = Notification(
            user_id=user.id,
            type=type,
            title=title,
            message=message,
            reference_id=reference_id
        )
        notifications.append(notification)
        
    if notifications:
        db.add_all(notifications)
        # Flush to DB (we don't commit here, let the calling service commit)
        db.flush()
