import {
  useRef,
  useEffect,
  useCallback,
  useState,
  ReactNode,
  MouseEvent as ReactMouseEvent,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { handleKeyPress } from '../../utils/a11y';
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

interface SheetContentProps {
  onClose?: (() => void) | undefined;
  title?: string | undefined;
  children: ReactNode;
  showCloseButton?: boolean | undefined;
  className?: string | undefined;
  headerAction?: ReactNode | undefined;
}

/**
 * Inner component that manages drag state - remounts fresh each time sheet opens
 */
function SheetContent({
  onClose,
  title,
  children,
  showCloseButton,
  className = '',
  headerAction,
}: SheetContentProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);

  // Motion values for drag gesture
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 200], [1, 0.5]);

  // Handle drag end - close if dragged down enough or with enough velocity
  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);
      const shouldClose = info.offset.y > 100 || info.velocity.y > 500;
      if (shouldClose) {
        onClose?.();
      }
    },
    [onClose]
  );

  // Check if we should allow dragging (only at top of scroll)
  const handleDragStart = useCallback(() => {
    const content = contentRef.current;
    if (content && content.scrollTop > 0) {
      return false; // Prevent drag if scrolled down
    }
    setIsDragging(true);
    return true;
  }, []);

  // Handle clicks on empty space within the sheet body to close
  const handleBodyClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Only close if clicking directly on the body background (not any child elements)
      // This allows tap-to-dismiss behavior when tapping empty space
      if (target.classList.contains('bottom-sheet-body')) {
        // Check if MultiDepartmentSelect was just clicked (within last 500ms)
        const multiDeptClickTime = (window as Window & { __multiDeptSelectClickTime?: number })
          .__multiDeptSelectClickTime;
        if (multiDeptClickTime && Date.now() - multiDeptClickTime < 500) {
          return; // Don't close - department selection in progress
        }
        onClose?.();
      }
    },
    [onClose]
  );

  // Handle wheel and touch events manually to fix Framer Motion drag intercepting scroll
  // When drag="y" is enabled, Framer Motion sets touch-action: pan-x which can
  // interfere with native scrolling. These handlers ensure scroll events
  // properly scroll the content inside the bottom sheet body.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    // Find the scrollable element inside the body
    const getScrollable = () =>
      body.querySelector<HTMLElement>('.settings-panel') ||
      body.querySelector<HTMLElement>('[data-scrollable]') ||
      body;

    // Wheel handler for desktop
    const handleWheel = (e: WheelEvent) => {
      const scrollable = getScrollable();
      const canScroll = scrollable.scrollHeight > scrollable.clientHeight;
      if (!canScroll) return;

      const atTop = scrollable.scrollTop <= 0;
      const atBottom =
        scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if ((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom)) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      scrollable.scrollTop += e.deltaY;
    };

    // Touch handlers for mobile - manually implement scroll
    let touchStartY = 0;
    let scrollableElement: HTMLElement | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        touchStartY = touch.clientY;
      }
      scrollableElement = getScrollable();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!scrollableElement) return;

      const canScroll = scrollableElement.scrollHeight > scrollableElement.clientHeight;
      if (!canScroll) return;

      const touch = e.touches[0];
      if (!touch) return;

      const touchY = touch.clientY;
      const deltaY = touchStartY - touchY; // Positive = scrolling down, negative = scrolling up
      touchStartY = touchY;

      const atTop = scrollableElement.scrollTop <= 0;
      const atBottom =
        scrollableElement.scrollTop + scrollableElement.clientHeight >=
        scrollableElement.scrollHeight - 1;

      // Allow default behavior at boundaries (enables pull-to-dismiss)
      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        return;
      }

      // Prevent Framer Motion from intercepting and manually scroll
      e.preventDefault();
      e.stopPropagation();
      scrollableElement.scrollTop += deltaY;
    };

    // Add with passive: false to allow preventDefault()
    body.addEventListener('wheel', handleWheel, { passive: false });
    body.addEventListener('touchstart', handleTouchStart, { passive: true });
    body.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      body.removeEventListener('wheel', handleWheel);
      body.removeEventListener('touchstart', handleTouchStart);
      body.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
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
        onKeyDown={handleKeyPress(() => onClose?.())}
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

      {/* Body - tap empty space to close, wheel handler via useEffect for scroll fix */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={bodyRef}
        className="bottom-sheet-body"
        onClick={handleBodyClick}
        onKeyDown={handleKeyPress(handleBodyClick)}
      >
        {children}
      </div>
    </motion.div>
  );
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
  // Handle Escape key to close (since we disabled onOpenChange)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't close if a Select dropdown is open (it will handle its own Escape)
        const selectContent = document.querySelector('[data-radix-select-content]');
        if (selectContent) return;

        // Check if a Select dropdown was just dismissed (within last 300ms)
        // This handles the race condition where Escape closes the dropdown first,
        // then this handler runs and the DOM element is already gone
        const selectDismissTime = (window as Window & { __radixSelectJustDismissed?: number })
          .__radixSelectJustDismissed;
        if (selectDismissTime && Date.now() - selectDismissTime < 300) {
          return;
        }

        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        // Only handle explicit close requests (not from nested Radix components)
        // The overlay onClick and handle onClick will handle closing directly
        if (!open) {
          // Check if a Radix Select dropdown was just dismissed (within last 300ms)
          // This prevents the modal from closing when clicking the select trigger to close dropdown
          const selectDismissTime = (window as Window & { __radixSelectJustDismissed?: number })
            .__radixSelectJustDismissed;
          if (selectDismissTime && Date.now() - selectDismissTime < 300) {
            return; // Don't close - dropdown was just dismissed
          }
          // Check if MultiDepartmentSelect was just clicked
          const multiDeptClickTime = (window as Window & { __multiDeptSelectClickTime?: number })
            .__multiDeptSelectClickTime;
          if (multiDeptClickTime && Date.now() - multiDeptClickTime < 500) {
            return; // Don't close - department selection in progress
          }
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
                onClick={(e) => {
                  // Don't close if clicking fixed-position buttons
                  const target = e.target as HTMLElement;
                  if (target.closest('.theme-toggle-container, .help-button-container')) {
                    return;
                  }
                  // Check if a Radix Select dropdown was just dismissed (click-outside to close dropdown)
                  const selectDismissTime = (
                    window as Window & { __radixSelectJustDismissed?: number }
                  ).__radixSelectJustDismissed;
                  if (selectDismissTime && Date.now() - selectDismissTime < 300) {
                    return;
                  }
                  // Check if MultiDepartmentSelect was just clicked
                  const multiDeptClickTime = (
                    window as Window & { __multiDeptSelectClickTime?: number }
                  ).__multiDeptSelectClickTime;
                  if (multiDeptClickTime && Date.now() - multiDeptClickTime < 500) {
                    return;
                  }
                  // Also check if fixed buttons were clicked recently (backup check)
                  const themeClickTime = (window as Window & { __themeToggleClickTime?: number })
                    .__themeToggleClickTime;
                  const helpClickTime = (window as Window & { __helpButtonClickTime?: number })
                    .__helpButtonClickTime;
                  if (
                    (themeClickTime && Date.now() - themeClickTime < 500) ||
                    (helpClickTime && Date.now() - helpClickTime < 500)
                  ) {
                    return;
                  }
                  onClose?.();
                }}
              />
            </Dialog.Overlay>

            {/* Sheet content - inner component remounts fresh each open */}
            <Dialog.Content
              asChild
              onInteractOutside={(e) => {
                // Don't close if clicking fixed-position buttons
                const target = e.target as HTMLElement;
                if (target.closest('.theme-toggle-container, .help-button-container')) {
                  e.preventDefault();
                  return;
                }
                // Don't close if interacting with Radix Select components (dropdown trigger, content, etc.)
                if (
                  target.closest(
                    '[data-radix-select-trigger], [data-radix-select-content], [data-radix-select-viewport], [data-radix-collection-item]'
                  )
                ) {
                  e.preventDefault();
                  return;
                }
                // Check if a Radix Select dropdown was just dismissed
                const selectDismissTime = (
                  window as Window & { __radixSelectJustDismissed?: number }
                ).__radixSelectJustDismissed;
                if (selectDismissTime && Date.now() - selectDismissTime < 300) {
                  e.preventDefault();
                  return;
                }
                // Check if MultiDepartmentSelect was just clicked
                const multiDeptClickTime = (
                  window as Window & { __multiDeptSelectClickTime?: number }
                ).__multiDeptSelectClickTime;
                if (multiDeptClickTime && Date.now() - multiDeptClickTime < 500) {
                  e.preventDefault();
                  return;
                }
                // Also check if fixed buttons were clicked recently (backup check)
                const themeClickTime = (window as Window & { __themeToggleClickTime?: number })
                  .__themeToggleClickTime;
                const helpClickTime = (window as Window & { __helpButtonClickTime?: number })
                  .__helpButtonClickTime;
                if (
                  (themeClickTime && Date.now() - themeClickTime < 500) ||
                  (helpClickTime && Date.now() - helpClickTime < 500)
                ) {
                  e.preventDefault();
                }
              }}
              onPointerDownOutside={(e) => {
                // Don't close if clicking fixed-position buttons
                const target = e.target as HTMLElement;
                if (target.closest('.theme-toggle-container, .help-button-container')) {
                  e.preventDefault();
                  return;
                }
                // Don't close if clicking on Radix Select components
                if (
                  target.closest(
                    '[data-radix-select-trigger], [data-radix-select-content], [data-radix-select-viewport], [data-radix-collection-item]'
                  )
                ) {
                  e.preventDefault();
                  return;
                }
                // Check if a Radix Select dropdown was just dismissed
                const selectDismissTime = (
                  window as Window & { __radixSelectJustDismissed?: number }
                ).__radixSelectJustDismissed;
                if (selectDismissTime && Date.now() - selectDismissTime < 300) {
                  e.preventDefault();
                  return;
                }
                // Check if MultiDepartmentSelect was just clicked
                const multiDeptClickTime = (
                  window as Window & { __multiDeptSelectClickTime?: number }
                ).__multiDeptSelectClickTime;
                if (multiDeptClickTime && Date.now() - multiDeptClickTime < 500) {
                  e.preventDefault();
                  return;
                }
                // Also check if fixed buttons were clicked recently (backup check)
                const themeClickTime = (window as Window & { __themeToggleClickTime?: number })
                  .__themeToggleClickTime;
                const helpClickTime = (window as Window & { __helpButtonClickTime?: number })
                  .__helpButtonClickTime;
                if (
                  (themeClickTime && Date.now() - themeClickTime < 500) ||
                  (helpClickTime && Date.now() - helpClickTime < 500)
                ) {
                  e.preventDefault();
                }
              }}
            >
              <SheetContent
                onClose={onClose}
                title={title}
                showCloseButton={showCloseButton}
                className={className}
                headerAction={headerAction}
              >
                {children}
              </SheetContent>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export default BottomSheet;
