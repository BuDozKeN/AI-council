import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { X, ChevronUp, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { logger } from "../../utils/logger"
import "./AppModal.css"

type BadgeVariant = "default" | "success" | "info" | "warning" | "purple";
type ModalSize = "sm" | "md" | "lg" | "xl" | "full";

interface AppModalProps {
  isOpen: boolean;
  onClose?: (() => void) | undefined;
  title?: string | undefined;
  description?: string | undefined;
  badge?: string | undefined;
  badgeVariant?: BadgeVariant | undefined;
  badgeStyle?: React.CSSProperties | undefined;
  titleExtra?: React.ReactNode | undefined;
  children?: React.ReactNode | undefined;
  size?: ModalSize | undefined;
  className?: string | undefined;
  showCloseButton?: boolean | undefined;
  closeOnOverlayClick?: boolean | undefined;
  headerClassName?: string | undefined;
  contentClassName?: string | undefined;
  bodyMinHeight?: string | number | undefined;
  showScrollTop?: boolean | undefined;
  scrollThreshold?: number | undefined;
  copyText?: string | null | undefined;
}

interface AppModalFooterProps {
  children?: React.ReactNode | undefined;
  className?: string | undefined;
}

interface AppModalComponent extends React.ForwardRefExoticComponent<AppModalProps & React.RefAttributes<HTMLDivElement>> {
  Footer: React.FC<AppModalFooterProps>;
}

/**
 * AppModal - Unified modal component built on Radix Dialog
 *
 * Features:
 * - Proper focus trap (keyboard users stay within modal)
 * - Escape key closes modal
 * - Click outside closes modal
 * - Accessible (ARIA labels, focus management)
 * - Consistent styling via design tokens
 * - Optional badge for categorization
 *
 * Usage:
 * <AppModal isOpen={showModal} onClose={() => setShowModal(false)} title="My Modal">
 *   <p>Modal content here</p>
 * </AppModal>
 *
 * With badge:
 * <AppModal isOpen={show} onClose={handleClose} title="Edit Context" badge="COMPANY" badgeVariant="success">
 *   <p>Content here</p>
 * </AppModal>
 *
 * Badge variants: "default", "success", "info", "warning", "purple"
 */

const AppModalBase = React.forwardRef<HTMLDivElement, AppModalProps>(({
  isOpen,
  onClose,
  title,
  description,
  badge,
  badgeVariant = "default",
  badgeStyle,
  titleExtra,
  children,
  size = "md",
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  headerClassName,
  contentClassName,
  bodyMinHeight,
  showScrollTop = true,
  scrollThreshold = 150,
  copyText = null,
}, ref) => {
  const bodyStyle = bodyMinHeight ? { minHeight: bodyMinHeight } : undefined
  const bodyRef = React.useRef<HTMLDivElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement | null>(null)
  const [showScrollButton, setShowScrollButton] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Swipe-to-dismiss state (mobile only)
  const dragStartY = React.useRef<number | null>(null)

  // Handle swipe-to-dismiss on mobile
  const handleTouchStart = React.useCallback((e: TouchEvent) => {
    const body = bodyRef.current
    if (!body) return

    // Don't interfere with button clicks
    const touchTarget = e.target as HTMLElement
    if (touchTarget.closest('button, a, [role="button"], input, textarea, select')) {
      return
    }

    // Only track if we're at the top of scroll or touching the drag handle
    const isAtTop = body.scrollTop <= 0
    const firstTouch = e.touches[0]
    const isDragHandle = touchTarget.closest('.app-modal-content::before') ||
                         (firstTouch?.clientY ?? 0) < 50 // Top 50px is drag area

    if (isAtTop || isDragHandle) {
      dragStartY.current = firstTouch?.clientY ?? null
    }
  }, [])

  const handleTouchEnd = React.useCallback((e: TouchEvent) => {
    if (dragStartY.current === null) return

    const changedTouch = e.changedTouches[0]
    const deltaY = (changedTouch?.clientY ?? 0) - dragStartY.current
    dragStartY.current = null

    // If swiped down more than 80px, close the modal
    if (deltaY > 80 && closeOnOverlayClick) {
      onClose?.()
    }
  }, [onClose, closeOnOverlayClick])

  // Attach touch listeners for swipe-to-dismiss on mobile
  React.useEffect(() => {
    const content = contentRef.current
    if (!content || !isOpen) return

    // Only enable on mobile
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    if (!isMobile) return

    content.addEventListener('touchstart', handleTouchStart, { passive: true })
    content.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      content.removeEventListener('touchstart', handleTouchStart)
      content.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isOpen, handleTouchStart, handleTouchEnd])

  // Handle scroll detection
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (showScrollTop) {
      setShowScrollButton((e.target as HTMLDivElement).scrollTop > scrollThreshold)
    }
  }, [showScrollTop, scrollThreshold])

  // Scroll to top handler
  const scrollToTop = React.useCallback(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Copy handler
  const handleCopy = React.useCallback(async () => {
    if (!copyText) return
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('Failed to copy:', err)
    }
  }, [copyText])

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="app-modal-overlay"
          onClick={closeOnOverlayClick ? () => onClose?.() : (e) => e.stopPropagation()}
        />
        <DialogPrimitive.Content
          ref={(node: HTMLDivElement | null) => {
            // Assign to both refs (forwardRef and internal contentRef)
            contentRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          className={cn("app-modal-content", `app-modal-${size}`, className)}
          onPointerDownOutside={closeOnOverlayClick ? () => { /* allow close */ } : (e) => e.preventDefault()}
        >
          <>
            {/* Accessibility: Title is always required by Radix */}
            {title ? (
              <DialogPrimitive.Title className="app-modal-title">
                {title}
              </DialogPrimitive.Title>
            ) : (
              <VisuallyHidden asChild>
                <DialogPrimitive.Title>Dialog</DialogPrimitive.Title>
              </VisuallyHidden>
            )}

            {/* Accessibility: Description is always required by Radix */}
            {description ? (
              <DialogPrimitive.Description className="app-modal-description-sr">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <VisuallyHidden asChild>
                <DialogPrimitive.Description>
                  {title ? `${title} dialog` : 'Dialog'}
                </DialogPrimitive.Description>
              </VisuallyHidden>
            )}

            {/* Header */}
            {(title || showCloseButton || badge) && (
              <div className={cn("app-modal-header", headerClassName)}>
                <div className="app-modal-header-text">
                  {title && (
                    <span className="app-modal-title-display">{title}</span>
                  )}
                  {badge && (
                    <span
                      className={cn("app-modal-badge", !badgeStyle && `app-modal-badge-${badgeVariant}`)}
                      style={badgeStyle}
                    >
                      {badge}
                    </span>
                  )}
                  {titleExtra && (
                    <span className="app-modal-title-extra">{titleExtra}</span>
                  )}
                  {description && (
                    <span className="app-modal-description">{description}</span>
                  )}
                </div>
                {showCloseButton && (
                  <DialogPrimitive.Close className="app-modal-close" aria-label="Close">
                    <X size={20} />
                  </DialogPrimitive.Close>
                )}
              </div>
            )}

            {/* Body */}
            <div
              ref={bodyRef}
              className={cn("app-modal-body", contentClassName)}
              style={bodyStyle}
              onScroll={handleScroll}
            >
              {/* Copy button - sticky top-right inside body */}
              {copyText && (
                <button
                  className={cn("app-modal-copy-btn", copied && "copied")}
                  onClick={handleCopy}
                  title={copied ? 'Copied!' : 'Copy content'}
                  aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              )}
              {children}
            </div>

            {/* Scroll to top - absolute bottom-right, aligned with copy */}
            {showScrollTop && showScrollButton && (
              <button
                className="app-modal-scroll-top-btn"
                onClick={scrollToTop}
                aria-label="Scroll to top"
              >
                <ChevronUp size={18} />
              </button>
            )}
          </>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
})

AppModalBase.displayName = "AppModal"

// Footer subcomponent for action buttons
const AppModalFooter: React.FC<AppModalFooterProps> = ({ children, className }) => (
  <div className={cn("app-modal-footer", className)}>
    {children}
  </div>
)

AppModalFooter.displayName = "AppModal.Footer"

// Create the compound component with Footer attached
const AppModal = AppModalBase as AppModalComponent
AppModal.Footer = AppModalFooter

export { AppModal }
export type { AppModalProps, AppModalFooterProps, ModalSize as AppModalSize }
