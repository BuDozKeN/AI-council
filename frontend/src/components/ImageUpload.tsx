import { useState, useCallback, useRef } from 'react';
import './ImageUpload.css';

/**
 * ImageUpload component for handling image attachments.
 * Supports:
 * - Clipboard paste (Ctrl+V)
 * - Drag and drop
 * - File picker
 */
export default function ImageUpload({
  images,
  onImagesChange,
  disabled = false,
  maxImages = 5,
  maxSizeMB = 10,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragHasImages, setDragHasImages] = useState(true); // Whether dragged files include images
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0); // Counter to handle nested drag events

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  const validateFile = (file) => {
    if (!allowedTypes.includes(file.type)) {
      return `Invalid file type: ${file.type}. Allowed: PNG, JPG, WebP, GIF`;
    }
    if (file.size > maxSizeBytes) {
      return `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Max: ${maxSizeMB}MB`;
    }
    return null;
  };

  const processFiles = useCallback((files) => {
    if (disabled) return;

    const newImages = [];
    const errors = [];

    for (const file of files) {
      if (images.length + newImages.length >= maxImages) {
        errors.push(`Maximum ${maxImages} images allowed`);
        break;
      }

      const validationError = validateFile(file);
      if (validationError) {
        errors.push(validationError);
        continue;
      }

      // Create preview URL
      const preview = URL.createObjectURL(file);
      newImages.push({
        file,
        preview,
        name: file.name,
        size: file.size,
        type: file.type,
      });
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }

    if (errors.length > 0) {
      setError(errors.join('. '));
      setTimeout(() => setError(null), 5000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- validateFile is stable within component
  }, [images, onImagesChange, disabled, maxImages, maxSizeBytes]);

  const removeImage = (index) => {
    const newImages = [...images];
    // Revoke the object URL to free memory
    URL.revokeObjectURL(newImages[index].preview);
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  // Handle paste event
  const handlePaste = useCallback((e) => {
    if (disabled) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      processFiles(imageFiles);
    }
  }, [processFiles, disabled]);

  // Drag and drop handlers - using counter to prevent flicker on child elements
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (!disabled && dragCounterRef.current === 1) {
      // Check if any of the dragged items are images
      const items = e.dataTransfer?.items;
      let hasImages = false;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            hasImages = true;
            break;
          }
        }
      } else {
        // Fallback - assume images if we can't check
        hasImages = true;
      }
      setDragHasImages(hasImages);
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0; // Reset counter on drop
    setIsDragging(false);

    if (disabled) return;

    // Only process image files - silently ignore non-images since we already
    // showed the warning during drag (no need for ugly error banners)
    const imageFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    );

    if (imageFiles.length > 0) {
      processFiles(imageFiles);
    }
  };

  // File picker
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const openFilePicker = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return {
    // Props to spread on the parent container for drag/drop
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
    // Paste handler to attach to textarea
    handlePaste,
    // State
    isDragging,
    error,
    // Actions
    removeImage,
    openFilePicker,
    // Hidden file input
    fileInput: (
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedTypes.join(',')}
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    ),
    // Image preview component
    previews: images.length > 0 ? (
      <div className="image-previews">
        {images.map((img, index) => (
          <div key={index} className="image-preview-item">
            <img src={img.preview} alt={img.name} />
            <button
              type="button"
              className="remove-image-btn"
              onClick={() => removeImage(index)}
              disabled={disabled}
              aria-label="Remove image"
            >
              &times;
            </button>
            <span className="image-name">{img.name}</span>
          </div>
        ))}
        {images.length < maxImages && (
          <button
            type="button"
            className="add-more-images-btn"
            onClick={openFilePicker}
            disabled={disabled}
          >
            <span>+</span>
            <span className="add-label">Add</span>
          </button>
        )}
      </div>
    ) : null,
    // Error display
    errorDisplay: error ? (
      <div className="image-upload-error">{error}</div>
    ) : null,
    // Drag overlay - shows different message for images vs non-images
    dragOverlay: isDragging ? (
      <div className={`drag-overlay ${dragHasImages ? '' : 'invalid'}`}>
        <div className="drag-overlay-content">
          {dragHasImages ? (
            <>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                <path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/>
              </svg>
              <span>Drop images here</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h2v2h-2v-2zm0-10h2v8h-2V7z"/>
              </svg>
              <span className="invalid-message">Only images are supported</span>
              <span className="invalid-hint">PNG, JPG, GIF, or WebP</span>
            </>
          )}
        </div>
      </div>
    ) : null,
  };
}
