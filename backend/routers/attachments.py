"""
Attachments Router

Endpoints for managing file attachments:
- Upload attachments (images)
- Get attachment metadata and URLs
- Delete attachments
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Form, Request
from typing import Optional
import re

from ..auth import get_current_user
from .. import attachments
from ..security import SecureHTTPException

# Import shared rate limiter (ensures limits are tracked globally)
from ..rate_limit import limiter


router = APIRouter(prefix="/attachments", tags=["attachments"])


# =============================================================================
# SECURITY HELPERS
# =============================================================================

UUID_PATTERN = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def validate_uuid(value: str, field_name: str = "id") -> str:
    """Validate that a value is a valid UUID format."""
    if not value or not UUID_PATTERN.match(value):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}: must be a valid UUID"
        )
    return value


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/upload")
@limiter.limit("30/minute;100/hour")
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    message_index: Optional[int] = Form(None),
    user: dict = Depends(get_current_user),
):
    """
    Upload an image attachment.

    The image is stored in Supabase Storage and a record is created
    in the attachments table. Returns a signed URL for immediate display.
    """
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    try:
        # Read file in chunks to validate size before loading fully into memory
        chunks = []
        total_size = 0
        CHUNK_SIZE = 8192  # Read in 8KB chunks
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"
                )
            chunks.append(chunk)
        file_data = b''.join(chunks)

        result = await attachments.upload_attachment(
            user_id=user["id"],
            access_token=user.get("access_token"),
            file_data=file_data,
            file_name=file.filename or "image.png",
            file_type=file.content_type or "image/png",
            conversation_id=conversation_id,
            message_index=message_index,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.get("/{attachment_id}")
@limiter.limit("100/minute;500/hour")
async def get_attachment(request: Request, attachment_id: str,
    user: dict = Depends(get_current_user),
):
    """Get attachment metadata and a fresh signed URL."""
    validate_uuid(attachment_id, "attachment_id")
    try:
        result = await attachments.get_attachment_data(
            user_id=user["id"],
            access_token=user.get("access_token"),
            attachment_id=attachment_id,
        )

        if not result:
            raise HTTPException(status_code=404, detail="Resource not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.get("/{attachment_id}/url")
@limiter.limit("100/minute;500/hour")
async def get_attachment_url(request: Request, attachment_id: str,
    user: dict = Depends(get_current_user),
):
    """Get a fresh signed URL for an attachment."""
    validate_uuid(attachment_id, "attachment_id")
    try:
        url = await attachments.get_attachment_url(
            user_id=user["id"],
            access_token=user.get("access_token"),
            attachment_id=attachment_id,
        )

        if not url:
            raise HTTPException(status_code=404, detail="Resource not found")

        return {"signed_url": url}

    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))


@router.delete("/{attachment_id}")
@limiter.limit("20/minute;50/hour")
async def delete_attachment(request: Request, attachment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete an attachment."""
    validate_uuid(attachment_id, "attachment_id")
    try:
        success = await attachments.delete_attachment(
            user_id=user["id"],
            access_token=user.get("access_token"),
            attachment_id=attachment_id,
        )

        if not success:
            raise HTTPException(status_code=404, detail="Resource not found")

        return {"success": True}

    except HTTPException:
        raise
    except Exception as e:
        raise SecureHTTPException.internal_error(str(e))
