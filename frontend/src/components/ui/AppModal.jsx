import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { X, ChevronUp, Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import "./AppModal.css"

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

const AppModal = React.forwardRef(({
  isOpen,
  onClose,
  title,
  description,
  badge,              // Optional badge text (e.g., "COMPANY", "PROJECT")
  badgeVariant = "default", // Badge color variant: "default", "success", "info", "warning", "purple"
  badgeStyle,         // Optional custom style for badge (overrides variant)
  titleExtra,         // Optional extra content after title (e.g., role count pill)
  children,
  size = "md",
  className,
  showCloseButton = true,
  closeOnOverlayClick = true,
  headerClassName,
  contentClassName,
  bodyMinHeight,
  showScrollTop = true, // Show scroll-to-top button when scrolled
  scrollThreshold = 150, // px scrolled before button appears
  copyText = null, // If provided, shows floating copy button
  ...props
}, ref) => {
  const bodyStyle = bodyMinHeight ? { minHeight: bodyMinHeight } : undefined
  const bodyRef = React.useRef(null)
  const [showScrollButton, setShowScrollButton] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Handle scroll detection
  const handleScroll = React.useCallback((e) => {
    if (showScrollTop) {
      setShowScrollButton(e.target.scrollTop > scrollThreshold)
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
      console.error('Failed to copy:', err)
    }
  }, [copyText])

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="app-modal-overlay"
          onClick={closeOnOverlayClick ? undefined : (e) => e.stopPropagation()}
        />
        <DialogPrimitive.Content
          ref={ref}
          className={cn("app-modal-content", `app-modal-${size}`, className)}
          onPointerDownOutside={closeOnOverlayClick ? undefined : (e) => e.preventDefault()}
          {...props}
        >
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
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
})

AppModal.displayName = "AppModal"

// Footer subcomponent for action buttons
const AppModalFooter = ({ children, className, ...props }) => (
  <div className={cn("app-modal-footer", className)} {...props}>
    {children}
  </div>
)

AppModalFooter.displayName = "AppModal.Footer"

// Attach Footer as a subcomponent
AppModal.Footer = AppModalFooter

export { AppModal }