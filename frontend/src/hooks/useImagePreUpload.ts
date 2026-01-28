/**
 * Hook for pre-uploading images on selection.
 *
 * Instead of uploading images when the user clicks Send,
 * this hook uploads images immediately when they're selected.
 * By the time the user finishes typing and clicks Send,
 * the images are likely already uploaded.
 */

import { useState, useCallback, useRef } from 'react';
import { api } from '../api';
import { logger } from '../utils/logger';
import { toast } from '../components/ui/sonner';

const log = logger.scope('ImagePreUpload');

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface PreUploadedImage {
  file: File;
  preview: string;
  name: string;
  size: number;
  type: string;
  /** Server-assigned attachment ID (available after upload completes) */
  attachmentId?: string;
  /** Current upload status */
  uploadStatus: UploadStatus;
  /** Error message if upload failed */
  error?: string;
}

interface UseImagePreUploadReturn {
  /** Current images with their upload status */
  images: PreUploadedImage[];
  /** Add new images (triggers immediate upload) */
  addImages: (
    newImages: Array<{ file: File; preview: string; name: string; size: number; type: string }>
  ) => void;
  /** Remove an image by index (cancels upload if pending) */
  removeImage: (index: number) => void;
  /** Clear all images */
  clearImages: () => void;
  /** Get attachment IDs, waiting for any pending uploads */
  getAttachmentIds: () => Promise<string[]>;
  /** Check if any uploads are still in progress */
  hasUploadsInProgress: boolean;
  /** Check if all images are ready (uploaded successfully) */
  allUploadsComplete: boolean;
}

export function useImagePreUpload(): UseImagePreUploadReturn {
  const [images, setImages] = useState<PreUploadedImage[]>([]);

  // Track upload promises so we can await them on send
  const uploadPromisesRef = useRef<Map<string, Promise<string | null>>>(new Map());

  // Generate a unique key for each image (used to track promises)
  const getImageKey = (img: { name: string; size: number; preview: string }) =>
    `${img.name}-${img.size}-${img.preview}`;

  const uploadImage = useCallback(async (image: PreUploadedImage): Promise<string | null> => {
    const imageKey = getImageKey(image);

    try {
      log.debug(`Starting upload for ${image.name}`);

      // Update status to uploading
      setImages((prev) =>
        prev.map((img) =>
          getImageKey(img) === imageKey
            ? { ...img, uploadStatus: 'uploading' as UploadStatus }
            : img
        )
      );

      const result = await api.uploadAttachment(image.file);
      const attachmentId = result.id;

      log.debug(`Upload complete for ${image.name}: ${attachmentId}`);

      // Update with attachment ID
      setImages((prev) =>
        prev.map((img) =>
          getImageKey(img) === imageKey
            ? { ...img, uploadStatus: 'uploaded' as UploadStatus, attachmentId }
            : img
        )
      );

      return attachmentId;
    } catch (error) {
      log.error(`Upload failed for ${image.name}:`, error);

      // Update status to failed
      setImages((prev) =>
        prev.map((img) =>
          getImageKey(img) === imageKey
            ? { ...img, uploadStatus: 'failed' as UploadStatus, error: 'Upload failed' }
            : img
        )
      );

      return null;
    }
  }, []);

  const addImages = useCallback(
    (
      newImages: Array<{ file: File; preview: string; name: string; size: number; type: string }>
    ) => {
      const imagesToAdd: PreUploadedImage[] = newImages.map((img) => ({
        ...img,
        uploadStatus: 'pending' as UploadStatus,
      }));

      setImages((prev) => [...prev, ...imagesToAdd]);

      // Start uploads immediately
      for (const image of imagesToAdd) {
        const imageKey = getImageKey(image);
        const uploadPromise = uploadImage(image);
        uploadPromisesRef.current.set(imageKey, uploadPromise);
      }
    },
    [uploadImage]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => {
      const imageToRemove = prev[index];
      if (imageToRemove) {
        // Clean up preview URL
        URL.revokeObjectURL(imageToRemove.preview);
        // Remove from promise tracking
        const imageKey = getImageKey(imageToRemove);
        uploadPromisesRef.current.delete(imageKey);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearImages = useCallback(() => {
    setImages((prev) => {
      // Clean up all preview URLs
      prev.forEach((img) => URL.revokeObjectURL(img.preview));
      return [];
    });
    uploadPromisesRef.current.clear();
  }, []);

  const getAttachmentIds = useCallback(async (): Promise<string[]> => {
    if (images.length === 0) return [];

    // Collect all pending/uploading images and wait for them
    const pendingUploads: Promise<string | null>[] = [];
    const readyIds: string[] = [];

    for (const image of images) {
      if (image.uploadStatus === 'uploaded' && image.attachmentId) {
        readyIds.push(image.attachmentId);
      } else if (image.uploadStatus === 'pending' || image.uploadStatus === 'uploading') {
        const imageKey = getImageKey(image);
        const promise = uploadPromisesRef.current.get(imageKey);
        if (promise) {
          pendingUploads.push(promise);
        }
      }
      // Skip failed uploads
    }

    if (pendingUploads.length > 0) {
      log.debug(`Waiting for ${pendingUploads.length} pending uploads...`);
      const results = await Promise.all(pendingUploads);
      const uploadedIds = results.filter((id): id is string => id !== null);

      if (uploadedIds.length < pendingUploads.length) {
        const failedCount = pendingUploads.length - uploadedIds.length;
        toast.error(`${failedCount} image(s) failed to upload`);
      }

      return [...readyIds, ...uploadedIds];
    }

    return readyIds;
  }, [images]);

  const hasUploadsInProgress = images.some(
    (img) => img.uploadStatus === 'pending' || img.uploadStatus === 'uploading'
  );

  const allUploadsComplete =
    images.length > 0 && images.every((img) => img.uploadStatus === 'uploaded');

  return {
    images,
    addImages,
    removeImage,
    clearImages,
    getAttachmentIds,
    hasUploadsInProgress,
    allUploadsComplete,
  };
}

export type { UseImagePreUploadReturn };
