import * as React from 'react';
import { useState, useEffect } from 'react';
import { AppModal } from './AppModal';
import { BottomSheet } from './BottomSheet';

/**
 * AdaptiveModal - Responsive modal that switches between AppModal and BottomSheet
 *
 * On desktop (>768px): Uses AppModal (centered modal)
 * On mobile (<=768px): Uses BottomSheet (slide up from bottom)
 *
 * This provides a native-feeling experience on mobile while maintaining
 * the traditional modal experience on desktop.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Callback when modal should close
 * @param {string} props.title - Modal title
 * @param {string} props.description - Optional description
 * @param {React.ReactNode} props.children - Modal content
 * @param {string} props.size - Size for desktop modal: "sm", "md", "lg", "xl"
 * @param {boolean} props.forceModal - Force AppModal even on mobile
 * @param {boolean} props.forceSheet - Force BottomSheet even on desktop
 * @param {string} props.className - Additional CSS class
 * @param {boolean} props.showCloseButton - Whether to show close button
 */
export function AdaptiveModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  forceModal = false,
  forceSheet = false,
  className = '',
  showCloseButton = true,
  // AppModal-specific props
  badge,
  badgeVariant,
  badgeStyle,
  titleExtra,
  headerClassName,
  contentClassName,
  bodyMinHeight,
  closeOnOverlayClick = true,
  ...props
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial state
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine which component to use
  const useBottomSheet = forceSheet || (isMobile && !forceModal);

  if (useBottomSheet) {
    return (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        showCloseButton={showCloseButton}
        className={className}
      >
        {children}
      </BottomSheet>
    );
  }

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      className={className}
      showCloseButton={showCloseButton}
      badge={badge}
      badgeVariant={badgeVariant}
      badgeStyle={badgeStyle}
      titleExtra={titleExtra}
      headerClassName={headerClassName}
      contentClassName={contentClassName}
      bodyMinHeight={bodyMinHeight}
      closeOnOverlayClick={closeOnOverlayClick}
      {...props}
    >
      {children}
    </AppModal>
  );
}

export default AdaptiveModal;
