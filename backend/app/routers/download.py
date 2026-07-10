import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.routers.generate import OUTPUT_DIR

router = APIRouter()


@router.get("/download/{filename}")
async def download_file(filename: str):
    file_path = OUTPUT_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="audio/mpeg",
    )