from pydantic import BaseModel
from typing import Dict

class SettingUpdate(BaseModel):
    settings: Dict[str, str]

class SettingResponse(BaseModel):
    key: str
    value: str | None
    description: str | None
