import { useRef, useEffect, useCallback, useState, ReactNode, MouseEvent as ReactMouseEvent } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import './BottomSheet.css';

interface BottomSheetProps {
  isOpen: boolean;
  onClose?: (() => void) | undefined;
  title?: string | undefined;
  children: ReactNode;
  showCloseButton?: boolean | undefined;
  className?: string | undefined;
  headerAction?: ReactNode | undefined;
}

/**
 * BottomSheet component - iOS/Android style sheet that slides up from bottom
 * On mobile: slides up from bottom with drag handle, swipe down to dismiss
 * On desktop: renders as centered modal
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = false, // Hidden by default - tap outside or swipe down to close
  className = '',
  headerAction,
}: BottomSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  // Motion values for drag gesture
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 200], [1, 0.5]);

  // Reset motion value and entry state when sheet opens/closes
  useEffect(() => {
    if (isOpen) {
      y.set(0); // Reset drag position
      setHasEntered(false); // Reset entry state
    }
  }, [isOpen, y]);

  // Handle drag end - close if dragged down enough or with enough velocity
  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const shouldClose = info.offset.y > 100 || info.velocity.y > 500;
    if (shouldClose) {
      onClose?.();
    }
  }, [onClose]);

  // Check if we should allow dragging (only at top of scroll)
  const handleDragStart = useCallback(() => {
    const content = contentRef.current;
    if (content && content.scrollTop > 0) {
      return false; // Prevent drag if scrolled down
    }
    setIsDragging(true);
    return true;
  }, []);

  // Handle Escape key to close (since we disabled onOpenChange)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't close if a Select dropdown is open (it will handle its own Escape)
        const selectContent = document.querySelector('[data-radix-select-content]');
        if (selectContent) return;

        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle clicks on empty space within the sheet body to close
  const handleBodyClick = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Only close if clicking directly on the body background (not any child elements)
    // This allows tap-to-dismiss behavior when tapping empty space
    if (target.classList.contains('bottom-sheet-body')) {
      onClose?.();
    }
  }, [onClose]);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        // Only handle explicit close requests (not from nested Radix components)
        // The overlay onClick and handle onClick will handle closing directly
        if (!open) {
          // Don't auto-close - let explicit handlers do it
          // This prevents Radix Select dropdown closing from bubbling up
        }
      }}
    >
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Backdrop - click to dismiss */}
            <Dialog.Overlay asChild>
              <motion.div
                className="bottom-sheet-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => onClose?.()}
              />
            </Dialog.Overlay>

            {/* Sheet content */}
            <Dialog.Content
              asChild
              onInteractOutside={(e) => {
                // Don't close if clicking the theme toggle
                const target = e.target as HTMLElement;
                if (target.closest('.theme-toggle-container')) {
                  e.preventDefault();
                }
              }}
              onPointerDownOutside={(e) => {
                // Don't close if clicking the theme toggle
                const target = e.target as HTMLElement;
                if (target.closest('.theme-toggle-container')) {
                  e.preventDefault();
                }
              }}
            >
              <motion.div
                ref={contentRef}
                className={`bottom-sheet-content ${isDragging ? 'is-dragging' : ''} ${className}`}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                // Only apply drag motion value AFTER entry animation completes
                // This prevents the y=0 from conflicting with initial={{ y: '100%' }}
                {...(hasEntered && { style: { y, opacity: isDragging ? opacity : 1 } })}
                drag={hasEntered ? 'y' : false}
                dragDirectionLock
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onAnimationComplete={() => setHasEntered(true)}
                transition={{
                  type: 'spring',
                  damping: 30,
                  stiffness: 300,
                }}
              >
                {/* Drag handle for mobile - tap to close */}
                <div
                  className="bottom-sheet-handle"
                  onClick={() => onClose?.()}
                  role="button"
                  tabIndex={0}
                  aria-label="Close sheet"
                >
                  <div className="bottom-sheet-handle-bar" />
                </div>

                {/* Header */}
                {(title || showCloseButton || headerAction) && (
                  <div className="bottom-sheet-header">
                    <Dialog.Title asChild>
                      <h1 className="bottom-sheet-title">{title}</h1>
                    </Dialog.Title>
                    <div className="bottom-sheet-header-actions">
                      {headerAction}
                      {showCloseButton && (
                        <button
                          type="button"
                          className="bottom-sheet-close"
                          onClick={() => onClose?.()}
                          aria-label="Close"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Visually hidden description for accessibility */}
                <Dialog.Description className="sr-only">
                  {title ? `${title} dialog` : 'Dialog content'}
                </Dialog.Description>

                {/* Body - tap empty space to close */}
                <div className="bottom-sheet-body" onClick={handleBodyClick}>
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default BottomSheet;
