import { useRef, useEffect, useCallback, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import './BottomSheet.css';

interface BottomSheetProps {
  isOpen: boolean;
  onClose?: (() => void) | undefined;
  title?: string | undefined;
  children: ReactNode;
  showCloseButton?: boolean | undefined;
  className?: string | undefined;
}

/**
 * BottomSheet component - iOS/Android style sheet that slides up from bottom
 * On mobile: slides up from bottom with drag handle
 * On desktop: renders as centered modal
 */
export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton = false, // Hidden by default - tap outside or swipe down to close
  className = '',
}: BottomSheetProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartScrollTop = useRef<number | null>(null);

  // Handle swipe-to-dismiss
  const handleTouchStart = useCallback((e: TouchEvent) => {
    const content = contentRef.current;
    if (!content) return;

    // Don't interfere with button clicks
    const touchTarget = e.target as HTMLElement;
    if (touchTarget.closest('button, a, [role="button"], input, textarea, select')) {
      return;
    }

    // Only track if we're at the top of scroll or touching the handle
    const isAtTop = content.scrollTop <= 0;
    const isHandle = touchTarget.closest('.bottom-sheet-handle');

    if (isAtTop || isHandle) {
      dragStartY.current = e.touches[0]?.clientY ?? null;
      dragStartScrollTop.current = content.scrollTop;
    }
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (dragStartY.current === null) return;

    const deltaY = (e.changedTouches[0]?.clientY ?? 0) - dragStartY.current;
    dragStartY.current = null;

    // If swiped down more than 100px, close the sheet
    if (deltaY > 100) {
      onClose?.();
    }
  }, [onClose]);

  // Attach touch listeners
  useEffect(() => {
    const content = contentRef.current;
    if (!content || !isOpen) return;

    content.addEventListener('touchstart', handleTouchStart, { passive: true });
    content.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      content.removeEventListener('touchstart', handleTouchStart);
      content.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, handleTouchStart, handleTouchEnd]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
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
                onClick={onClose}
              />
            </Dialog.Overlay>

            {/* Sheet content */}
            <Dialog.Content asChild>
              <motion.div
                ref={contentRef}
                className={`bottom-sheet-content ${className}`}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{
                  type: 'spring',
                  damping: 30,
                  stiffness: 300,
                }}
              >
                {/* Drag handle for mobile */}
                <div className="bottom-sheet-handle">
                  <div className="bottom-sheet-handle-bar" />
                </div>

                {/* Header */}
                {(title || showCloseButton) && (
                  <div className="bottom-sheet-header">
                    <Dialog.Title className="bottom-sheet-title">
                      {title}
                    </Dialog.Title>
                    {showCloseButton && (
                      <Dialog.Close className="bottom-sheet-close">
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
                      </Dialog.Close>
                    )}
                  </div>
                )}
                {/* Visually hidden description for accessibility */}
                <Dialog.Description className="sr-only">
                  {title ? `${title} dialog` : 'Dialog content'}
                </Dialog.Description>

                {/* Body */}
                <div className="bottom-sheet-body">
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
