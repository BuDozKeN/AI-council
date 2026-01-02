"""Attachment handling for image uploads to Supabase Storage.

SECURITY NOTE: This module handles direct file uploads only (multipart/form-data).
It does NOT fetch images from URLs, so SSRF (Server-Side Request Forgery) is not applicable.
All images are validated using magic bytes to prevent MIME type spoofing.
"""

import uuid
from datetime import datetime
from typing import Optional
from .database import get_supabase_with_auth, get_supabase_service

# Constants
BUCKET_NAME = "attachments"
ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Allowed file extensions (must match ALLOWED_MIME_TYPES)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

# Magic bytes for image file validation
# These are the first few bytes that identify file types
IMAGE_MAGIC_BYTES = {
    "image/png": [b'\x89PNG\r\n\x1a\n'],
    "image/jpeg": [b'\xff\xd8\xff'],
    "image/gif": [b'GIF87a', b'GIF89a'],
    "image/webp": [b'RIFF'],  # WebP starts with RIFF, then has WEBP at offset 8
}


def validate_image_magic_bytes(file_data: bytes, claimed_mime_type: str) -> bool:
    """
    Validate that file content matches the claimed MIME type using magic bytes.

    This prevents MIME type spoofing attacks where an attacker claims a file
    is an image but actually uploads malicious content.

    Args:
        file_data: Raw file bytes
        claimed_mime_type: The MIME type claimed by the client

    Returns:
        True if magic bytes match the claimed type, False otherwise
    """
    if claimed_mime_type not in IMAGE_MAGIC_BYTES:
        return False

    magic_patterns = IMAGE_MAGIC_BYTES[claimed_mime_type]

    for pattern in magic_patterns:
        if file_data.startswith(pattern):
            # Special case for WebP: verify WEBP marker at offset 8
            if claimed_mime_type == "image/webp":
                if len(file_data) >= 12 and file_data[8:12] == b'WEBP':
                    return True
                return False
            return True

    return False


async def upload_attachment(
    user_id: str,
    access_token: str,
    file_data: bytes,
    file_name: str,
    file_type: str,
    conversation_id: Optional[str] = None,
    message_index: Optional[int] = None,
) -> dict:
    """
    Upload an attachment to Supabase Storage and record it in the attachments table.

    Args:
        user_id: The authenticated user's ID
        access_token: The user's JWT token for authenticated operations
        file_data: The raw file bytes
        file_name: Original file name
        file_type: MIME type (e.g., 'image/png')
        conversation_id: Optional conversation ID to link to
        message_index: Optional message index within the conversation

    Returns:
        Dict with attachment metadata including signed URL

    Raises:
        ValueError: If file type is not allowed or file is too large
    """
    # Validate file type
    if file_type not in ALLOWED_MIME_TYPES:
        raise ValueError(f"File type '{file_type}' not allowed. Allowed types: {', '.join(ALLOWED_MIME_TYPES)}")

    # Validate file size
    if len(file_data) > MAX_FILE_SIZE:
        raise ValueError(f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB")

    # SECURITY: Validate magic bytes match claimed MIME type
    # This prevents MIME type spoofing attacks
    if not validate_image_magic_bytes(file_data, file_type):
        raise ValueError(f"File content does not match claimed type '{file_type}'")

    # Generate unique file path: user_id/uuid.extension
    # SECURITY: Validate and whitelist file extension
    file_ext = file_name.split('.')[-1].lower() if '.' in file_name else 'png'
    if file_ext not in ALLOWED_EXTENSIONS:
        # Fall back to extension based on MIME type for safety
        mime_to_ext = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/webp': 'webp',
            'image/gif': 'gif'
        }
        file_ext = mime_to_ext.get(file_type, 'png')
    unique_id = str(uuid.uuid4())
    storage_path = f"{user_id}/{unique_id}.{file_ext}"

    # Get authenticated client for database operations
    client = get_supabase_with_auth(access_token)

    # Use service client for storage (bypasses RLS)
    # This is safe because user is already authenticated and file path includes user_id
    service_client = get_supabase_service()
    storage_client = service_client if service_client else client

    # Upload to Supabase Storage
    try:
        upload_result = storage_client.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=file_data,
            file_options={"content-type": file_type}
        )
    except Exception as e:
        raise ValueError(f"Failed to upload file to storage: {str(e)}")

    # Create attachment record in database
    attachment_data = {
        "user_id": user_id,
        "file_name": file_name,
        "file_type": file_type,
        "file_size": len(file_data),
        "storage_path": storage_path,
    }

    if conversation_id:
        attachment_data["conversation_id"] = conversation_id
    if message_index is not None:
        attachment_data["message_index"] = message_index

    try:
        result = client.table("attachments").insert(attachment_data).execute()
        attachment = result.data[0] if result.data else None
    except Exception as e:
        # If DB insert fails, try to clean up the uploaded file
        try:
            storage_client.storage.from_(BUCKET_NAME).remove([storage_path])
        except:
            pass
        raise ValueError(f"Failed to create attachment record: {str(e)}")

    # Generate a signed URL for the image (valid for 1 hour)
    try:
        signed_url_response = storage_client.storage.from_(BUCKET_NAME).create_signed_url(
            path=storage_path,
            expires_in=3600  # 1 hour
        )
        signed_url = signed_url_response.get("signedURL") or signed_url_response.get("signed_url")
    except Exception as e:
        signed_url = None

    return {
        "id": attachment["id"],
        "file_name": file_name,
        "file_type": file_type,
        "file_size": len(file_data),
        "storage_path": storage_path,
        "signed_url": signed_url,
        "created_at": attachment.get("created_at"),
    }


async def get_attachment_url(
    user_id: str,
    access_token: str,
    attachment_id: str,
) -> Optional[str]:
    """
    Get a signed URL for an attachment.

    Args:
        user_id: The authenticated user's ID
        access_token: The user's JWT token
        attachment_id: The attachment ID

    Returns:
        Signed URL string or None if not found
    """
    client = get_supabase_with_auth(access_token)

    # Get attachment record (RLS will ensure user owns it)
    result = client.table("attachments").select("storage_path").eq("id", attachment_id).execute()

    if not result.data:
        return None

    storage_path = result.data[0]["storage_path"]

    # Use service client for storage operations
    service_client = get_supabase_service()
    storage_client = service_client if service_client else client

    # Generate signed URL
    try:
        signed_url_response = storage_client.storage.from_(BUCKET_NAME).create_signed_url(
            path=storage_path,
            expires_in=3600  # 1 hour
        )
        return signed_url_response.get("signedURL") or signed_url_response.get("signed_url")
    except:
        return None


async def delete_attachment(
    user_id: str,
    access_token: str,
    attachment_id: str,
) -> bool:
    """
    Delete an attachment from storage and database.

    Args:
        user_id: The authenticated user's ID
        access_token: The user's JWT token
        attachment_id: The attachment ID

    Returns:
        True if deleted successfully, False otherwise
    """
    client = get_supabase_with_auth(access_token)

    # Get attachment record to find storage path
    result = client.table("attachments").select("storage_path").eq("id", attachment_id).execute()

    if not result.data:
        return False

    storage_path = result.data[0]["storage_path"]

    # Use service client for storage operations
    service_client = get_supabase_service()
    storage_client = service_client if service_client else client

    # Delete from storage
    try:
        storage_client.storage.from_(BUCKET_NAME).remove([storage_path])
    except:
        pass  # Continue even if storage delete fails

    # Delete from database
    try:
        client.table("attachments").delete().eq("id", attachment_id).execute()
        return True
    except:
        return False


async def download_attachment(
    user_id: str,
    access_token: str,
    attachment_id: str,
) -> Optional[dict]:
    """
    Download the actual file data for an attachment.

    Args:
        user_id: The authenticated user's ID
        access_token: The user's JWT token
        attachment_id: The attachment ID

    Returns:
        Dict with file data, type, and name, or None if not found
    """
    client = get_supabase_with_auth(access_token)

    # Get only needed columns (RLS ensures user owns it)
    result = client.table("attachments").select("id, storage_path, file_type, file_name").eq("id", attachment_id).execute()

    if not result.data:
        return None

    attachment = result.data[0]
    storage_path = attachment["storage_path"]

    # Use service client for storage operations
    service_client = get_supabase_service()
    storage_client = service_client if service_client else client

    # Download file from storage
    try:
        file_data = storage_client.storage.from_(BUCKET_NAME).download(storage_path)
        return {
            "data": file_data,
            "type": attachment["file_type"],
            "name": attachment["file_name"],
            "id": attachment["id"],
        }
    except Exception:
        return None


async def get_attachment_data(
    user_id: str,
    access_token: str,
    attachment_id: str,
) -> Optional[dict]:
    """
    Get attachment metadata and a fresh signed URL.

    Args:
        user_id: The authenticated user's ID
        access_token: The user's JWT token
        attachment_id: The attachment ID

    Returns:
        Attachment data dict with signed URL, or None if not found
    """
    client = get_supabase_with_auth(access_token)

    # Get only needed columns (RLS ensures user owns it)
    result = client.table("attachments").select(
        "id, file_name, file_type, file_size, storage_path, created_at"
    ).eq("id", attachment_id).execute()

    if not result.data:
        return None

    attachment = result.data[0]

    # Use service client for storage operations
    service_client = get_supabase_service()
    storage_client = service_client if service_client else client

    # Generate fresh signed URL
    try:
        signed_url_response = storage_client.storage.from_(BUCKET_NAME).create_signed_url(
            path=attachment["storage_path"],
            expires_in=3600
        )
        signed_url = signed_url_response.get("signedURL") or signed_url_response.get("signed_url")
    except:
        signed_url = None

    return {
        **attachment,
        "signed_url": signed_url,
    }
