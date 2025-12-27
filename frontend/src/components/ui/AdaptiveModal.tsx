import { useState, useEffect, ReactNode, CSSProperties } from 'react';
import { AppModal, AppModalSize } from './AppModal';
import { BottomSheet } from './BottomSheet';

type BadgeVariant = 'default' | 'success' | 'warning' | 'info' | 'purple';

interface AdaptiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string | undefined;
  description?: string | undefined;
  children?: ReactNode | undefined;
  size?: AppModalSize | undefined;
  forceModal?: boolean | undefined;
  forceSheet?: boolean | undefined;
  className?: string | undefined;
  showCloseButton?: boolean | undefined;
  badge?: string | undefined;
  badgeVariant?: BadgeVariant | undefined;
  badgeStyle?: CSSProperties | undefined;
  titleExtra?: ReactNode | undefined;
  headerClassName?: string | undefined;
  contentClassName?: string | undefined;
  bodyMinHeight?: string | undefined;
  closeOnOverlayClick?: boolean | undefined;
}

/**
 * AdaptiveModal - Responsive modal that switches between AppModal and BottomSheet
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
}: AdaptiveModalProps) {
  const [isMobile, setIsMobile] = useState<boolean>(false);

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
    >
      {children}
    </AppModal>
  );
}

export default AdaptiveModal;
