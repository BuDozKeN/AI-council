/**
 * MultiPlaybookSelect - A multi-select component for playbooks
 *
 * Uses Radix Popover for the dropdown and checkboxes for multi-select.
 * Groups playbooks by type (SOP, Framework, Policy).
 * On mobile/tablet, uses BottomSheet for better UX.
 *
 * Usage:
 * <MultiPlaybookSelect
 *   value={selectedPlaybookIds}  // Array of playbook IDs
 *   onValueChange={setSelectedPlaybookIds}
 *   playbooks={playbooks}
 *   disabled={false}
 *   placeholder="Select playbooks..."
 * />
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { BookOpen, Check, ChevronDown, FileText, Scale, Cog, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import './MultiPlaybookSelect.css';

type PlaybookType = 'sop' | 'framework' | 'policy';

interface ExtendedPlaybook {
  id: string;
  title: string;
  doc_type: PlaybookType;
}

interface MultiPlaybookSelectProps {
  value?: string[] | undefined;
  onValueChange: (ids: string[]) => void;
  playbooks?: ExtendedPlaybook[] | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Icons for different playbook types
const TYPE_ICONS: Record<PlaybookType, LucideIcon> = {
  sop: Cog,
  framework: Scale,
  policy: FileText,
};

// TYPE_LABELS moved inside component for i18n - see getTypeLabels()

export function MultiPlaybookSelect({
  value = [],
  onValueChange,
  playbooks = [],
  disabled = false,
  placeholder,
  className,
}: MultiPlaybookSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const actualPlaceholder = placeholder || t('playbooks.selectPlaybooks');

  // Type labels need to be inside component for i18n
  const TYPE_LABELS: Record<PlaybookType, string> = {
    sop: t('context.sops'),
    framework: t('context.frameworks'),
    policy: t('context.policies'),
  };

  // Get selected playbooks with their data
  const selectedPlaybooks = value
    .map((id) => playbooks.find((p) => p.id === id))
    .filter((p): p is ExtendedPlaybook => Boolean(p));

  // Group playbooks by type, sorted alphabetically within each group
  const groupedPlaybooks = React.useMemo(() => {
    const groups: Record<PlaybookType, ExtendedPlaybook[]> = { sop: [], framework: [], policy: [] };
    playbooks.forEach((p: ExtendedPlaybook) => {
      if (groups[p.doc_type]) {
        groups[p.doc_type].push(p);
      }
    });
    // Sort each group alphabetically by title
    (Object.keys(groups) as PlaybookType[]).forEach((key: PlaybookType) => {
      groups[key].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    });
    return groups;
  }, [playbooks]);

  const togglePlaybook = (playbookId: string) => {
    if (value.includes(playbookId)) {
      onValueChange(value.filter((id) => id !== playbookId));
    } else {
      onValueChange([...value, playbookId]);
    }
  };

  // Utility function to remove a playbook - used by tag close buttons
  const removePlaybook = (e: React.MouseEvent, playbookId: string) => {
    e.stopPropagation();
    onValueChange(value.filter((id) => id !== playbookId));
  };

  // Get type badge color - used for styling
  const getTypeBadgeClass = (docType: PlaybookType): string => {
    switch (docType) {
      case 'sop':
        return 'playbook-badge-sop';
      case 'framework':
        return 'playbook-badge-framework';
      case 'policy':
        return 'playbook-badge-policy';
      default:
        return '';
    }
  };

  // Suppress unused variable warnings - these are available for future use
  void removePlaybook;
  void getTypeBadgeClass;

  // Shared trigger content - compact format like departments
  const triggerContent = (
    <>
      <BookOpen className="h-3.5 w-3.5 shrink-0" />

      {selectedPlaybooks.length === 0 ? (
        <span className="multi-playbook-placeholder">{actualPlaceholder}</span>
      ) : selectedPlaybooks.length === 1 ? (
        // Single playbook: show title (truncated)
        <span className="multi-playbook-single">{selectedPlaybooks[0]?.title}</span>
      ) : (
        // Multiple playbooks: show count
        <span className="multi-playbook-count">
          {t('multiSelect.playbooksCount', { count: selectedPlaybooks.length })}
        </span>
      )}

      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
    </>
  );

  // Shared playbook list content
  const playbookList = (isMobile = false) => (
    <div className={isMobile ? 'multi-playbook-list-mobile' : 'multi-playbook-list'}>
      {playbooks.length === 0 ? (
        <div className="multi-playbook-empty">{t('context.noPlaybooks')}</div>
      ) : (
        (Object.entries(groupedPlaybooks) as [PlaybookType, ExtendedPlaybook[]][]).map(
          ([type, items]) => {
            if (items.length === 0) return null;

            const TypeIcon = TYPE_ICONS[type] || BookOpen;

            return (
              <div
                key={type}
                className={isMobile ? 'multi-playbook-group-mobile' : 'multi-playbook-group'}
              >
                <div
                  className={
                    isMobile ? 'multi-playbook-group-header-mobile' : 'multi-playbook-group-header'
                  }
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                  <span>{TYPE_LABELS[type] || type}</span>
                  <span className="multi-playbook-group-count">{items.length}</span>
                </div>

                {items.map((playbook: ExtendedPlaybook) => {
                  const isSelected = value.includes(playbook.id);

                  return (
                    <button
                      key={playbook.id}
                      className={cn(
                        isMobile ? 'multi-playbook-item-mobile' : 'multi-playbook-item',
                        isSelected && 'selected'
                      )}
                      onClick={() => togglePlaybook(playbook.id)}
                      type="button"
                    >
                      <div className={cn('multi-playbook-checkbox', isSelected && 'checked')}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="multi-playbook-item-label">{playbook.title}</span>
                    </button>
                  );
                })}
              </div>
            );
          }
        )
      )}
    </div>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn('multi-playbook-trigger', className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          {triggerContent}
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title={t('playbooks.selectPlaybooks')}
        >
          {playbookList(true)}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={cn('multi-playbook-trigger', className)} disabled={disabled}>
        {triggerContent}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="multi-playbook-content" align="start" sideOffset={4}>
          {playbookList(false)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default MultiPlaybookSelect;
