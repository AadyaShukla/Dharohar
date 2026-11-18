"""Object storage service and audition verification live-prompt generator for Dharohar.

Supports Supabase Storage, S3-compatible storage, or local filesystem fallback.
Validates file sizes and MIME types strictly:
- Videos: MP4 only, max 100MB.
- Photos: JPG/PNG/WEBP, max 10MB.
"""

from __future__ import annotations

import os
from pathlib import Path
import random
from typing import Optional, Tuple
import uuid

from fastapi import HTTPException, UploadFile, status

# Allowed file constraints
MAX_VIDEO_BYTES = 100 * 1024 * 1024  # 100 Megabytes
MAX_PHOTO_BYTES = 10 * 1024 * 1024   # 10 Megabytes

ALLOWED_PHOTO_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_PHOTO_MIMES = {"image/jpeg", "image/png", "image/webp"}

# Live Challenge Prompt phrases
PROMPT_THEMES = [
    "Rangilo Rajasthan",
    "Desert Sarangi Swar",
    "Maati Ki Mehak",
    "Kalbelia Virasat",
    "Kathputli Parampara",
    "Ghoomar Tarang",
    "Dharohar Kalakar",
    "Surila Sangeet",
    "Lok Kala Darpan",
    "Shekhawati Swar",
]


def generate_live_prompt() -> str:
    """Generate a unique random challenge phrase that the artist must recite on camera."""
    theme = random.choice(PROMPT_THEMES)
    numeric_code = random.randint(1000, 9999)
    return f"{theme} - Code {numeric_code}"


def get_upload_dir() -> Path:
    """Ensure and return the local uploads directory path."""
    from backend.config import PROJECT_ROOT
    upload_path = PROJECT_ROOT / "uploads"
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


async def upload_file_to_storage(
    file: UploadFile,
    is_video: bool = False,
) -> Tuple[str, str]:
    """Validate, store file in object storage, and return (public_url, generated_filename).

    Raises HTTPException(400) if file exceeds limits or has invalid extension/MIME.
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file was provided for upload.",
        )

    filename = file.filename
    ext = Path(filename).suffix.lower()

    if is_video:
        # Validate video constraints: MP4 only, <= 100MB
        if ext != ".mp4":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid video format '{ext}'. Only .mp4 files are accepted for audition video.",
            )
        if file.content_type and "mp4" not in file.content_type.lower() and file.content_type != "application/octet-stream":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid video MIME type '{file.content_type}'. Must be video/mp4.",
            )
        max_bytes = MAX_VIDEO_BYTES
        label = "Video"
    else:
        # Validate photo constraints
        if ext not in ALLOWED_PHOTO_EXTS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image format '{ext}'. Allowed: .jpg, .jpeg, .png, .webp.",
            )
        if file.content_type and file.content_type.lower() not in ALLOWED_PHOTO_MIMES and file.content_type != "application/octet-stream":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid image MIME type '{file.content_type}'.",
            )
        max_bytes = MAX_PHOTO_BYTES
        label = "Image"

    # Read content and enforce size bound
    content = await file.read()
    if len(content) > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} file size ({len(content) / (1024*1024):.1f}MB) exceeds maximum allowed limit of {max_mb}MB.",
        )

    # Generate unique random filename
    random_filename = f"{uuid.uuid4().hex}{ext}"

    from backend.config import get_settings
    settings = get_settings()

    # Cloud Storage provider logic (Supabase / S3)
    storage_provider = getattr(settings, "STORAGE_PROVIDER", "local")
    supabase_url = getattr(settings, "SUPABASE_URL", None)
    supabase_key = getattr(settings, "SUPABASE_KEY", None)

    if storage_provider == "supabase" and supabase_url and supabase_key:
        try:
            import httpx
            bucket = getattr(settings, "STORAGE_BUCKET_NAME", "dharohar-media") or "dharohar-media"
            upload_url = f"{supabase_url.rstrip('/')}/storage/v1/object/{bucket}/{random_filename}"
            headers = {
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": file.content_type or "application/octet-stream",
            }
            async with httpx.AsyncClient() as client:
                res = await client.post(upload_url, content=content, headers=headers)
                if res.status_code in [200, 201]:
                    public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket}/{random_filename}"
                    return public_url, random_filename
        except Exception:
            # Fall back to local storage if cloud call encounters network or auth issue
            pass

    # S3 Compatible storage
    s3_endpoint = getattr(settings, "S3_ENDPOINT_URL", None)
    s3_key = getattr(settings, "S3_ACCESS_KEY_ID", None)
    if storage_provider == "s3" and s3_endpoint and s3_key:
        try:
            import boto3
            bucket = getattr(settings, "S3_BUCKET_NAME", "dharohar-media") or "dharohar-media"
            s3_client = boto3.client(
                "s3",
                endpoint_url=s3_endpoint,
                aws_access_key_id=s3_key,
                aws_secret_access_key=getattr(settings, "S3_SECRET_ACCESS_KEY", ""),
                region_name=getattr(settings, "S3_REGION", "ap-south-1"),
            )
            s3_client.put_object(
                Bucket=bucket,
                Key=random_filename,
                Body=content,
                ContentType=file.content_type or "application/octet-stream",
            )
            return f"{s3_endpoint.rstrip('/')}/{bucket}/{random_filename}", random_filename
        except Exception:
            pass

    # Local Filesystem Storage (default for development, testing, and offline prototype)
    local_dir = get_upload_dir()
    target_path = local_dir / random_filename
    with open(target_path, "wb") as f:
        f.write(content)

    public_url = f"/uploads/{random_filename}"
    return public_url, random_filename
