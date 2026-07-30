from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.database import get_db
from app.models.system_setting_model import SystemSetting
from app.schemas.setting_schema import SettingUpdate
from app.auth.dependencies import get_current_user
from app.auth.permissions import admin_required

router = APIRouter(
    prefix="/settings",
    tags=["Settings"]
)

@router.get("/")
def get_all_settings(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    settings = db.query(SystemSetting).all()
    # Convert to a simple key-value dictionary for the frontend
    return {s.key: s.value for s in settings}

@router.put("/")
def update_settings(
    update_data: SettingUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    admin_required(current_user)
    
    for key, value in update_data.settings.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            setting.value = value
        else:
            new_setting = SystemSetting(key=key, value=value)
            db.add(new_setting)
            
    db.commit()
    
    # Return updated settings
    updated_settings = db.query(SystemSetting).all()
    return {s.key: s.value for s in updated_settings}
