import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { X } from "lucide-react"
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
  ...props
}, ref) => {
  const bodyStyle = bodyMinHeight ? { minHeight: bodyMinHeight } : undefined

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
          <div className={cn("app-modal-body", contentClassName)} style={bodyStyle}>
            {children}
          </div>
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