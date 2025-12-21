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
import * as Popover from '@radix-ui/react-popover';
import { BookOpen, Check, ChevronDown, X, FileText, Scale, Cog } from 'lucide-react';
import { cn } from '../../lib/utils';
import { BottomSheet } from './BottomSheet';
import './MultiPlaybookSelect.css';

// Check if we're on mobile/tablet for bottom sheet vs dropdown
const isMobileDevice = () => typeof window !== 'undefined' && window.innerWidth <= 768;

// Icons for different playbook types
const TYPE_ICONS = {
  sop: Cog,
  framework: Scale,
  policy: FileText,
};

const TYPE_LABELS = {
  sop: 'SOP',
  framework: 'Framework',
  policy: 'Policy',
};

export function MultiPlaybookSelect({
  value = [],
  onValueChange,
  playbooks = [],
  disabled = false,
  placeholder = 'Select playbooks...',
  className,
}) {
  const [open, setOpen] = React.useState(false);

  // Get selected playbooks with their data
  const selectedPlaybooks = value
    .map(id => playbooks.find(p => p.id === id))
    .filter(Boolean);

  // Group playbooks by type
  const groupedPlaybooks = React.useMemo(() => {
    const groups = { sop: [], framework: [], policy: [] };
    playbooks.forEach(p => {
      if (groups[p.doc_type]) {
        groups[p.doc_type].push(p);
      }
    });
    return groups;
  }, [playbooks]);

  const togglePlaybook = (playbookId) => {
    if (value.includes(playbookId)) {
      onValueChange(value.filter(id => id !== playbookId));
    } else {
      onValueChange([...value, playbookId]);
    }
  };

  const removePlaybook = (e, playbookId) => {
    e.stopPropagation();
    onValueChange(value.filter(id => id !== playbookId));
  };

  // Get type badge color
  const getTypeBadgeClass = (docType) => {
    switch (docType) {
      case 'sop': return 'playbook-badge-sop';
      case 'framework': return 'playbook-badge-framework';
      case 'policy': return 'playbook-badge-policy';
      default: return '';
    }
  };

  // Shared trigger content
  const triggerContent = (
    <>
      <BookOpen className="h-3.5 w-3.5 shrink-0" />

      {selectedPlaybooks.length === 0 ? (
        <span className="multi-playbook-placeholder">{placeholder}</span>
      ) : (
        <div className="multi-playbook-badges">
          {selectedPlaybooks.map(playbook => (
            <span
              key={playbook.id}
              className={cn("multi-playbook-badge", getTypeBadgeClass(playbook.doc_type))}
            >
              {playbook.title}
              <span
                className="multi-playbook-badge-remove"
                onClick={(e) => removePlaybook(e, playbook.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && removePlaybook(e, playbook.id)}
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))}
        </div>
      )}

      <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-auto" />
    </>
  );

  // Shared playbook list content
  const playbookList = (isMobile = false) => (
    <div className={isMobile ? "multi-playbook-list-mobile" : "multi-playbook-list"}>
      {playbooks.length === 0 ? (
        <div className="multi-playbook-empty">No playbooks available</div>
      ) : (
        Object.entries(groupedPlaybooks).map(([type, items]) => {
          if (items.length === 0) return null;

          const TypeIcon = TYPE_ICONS[type] || BookOpen;

          return (
            <div key={type} className={isMobile ? "multi-playbook-group-mobile" : "multi-playbook-group"}>
              <div className={isMobile ? "multi-playbook-group-header-mobile" : "multi-playbook-group-header"}>
                <TypeIcon className="h-3.5 w-3.5" />
                <span>{TYPE_LABELS[type] || type}</span>
                <span className="multi-playbook-group-count">{items.length}</span>
              </div>

              {items.map(playbook => {
                const isSelected = value.includes(playbook.id);

                return (
                  <button
                    key={playbook.id}
                    className={cn(
                      isMobile ? "multi-playbook-item-mobile" : "multi-playbook-item",
                      isSelected && "selected"
                    )}
                    onClick={() => togglePlaybook(playbook.id)}
                    type="button"
                  >
                    <div className={cn("multi-playbook-checkbox", isSelected && "checked")}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div className="multi-playbook-item-info">
                      <span className="multi-playbook-item-label">{playbook.title}</span>
                      {playbook.summary && (
                        <span className="multi-playbook-item-desc">{playbook.summary}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <>
        <button
          className={cn("multi-playbook-trigger", className)}
          disabled={disabled}
          onClick={() => setOpen(true)}
          type="button"
        >
          {triggerContent}
        </button>

        <BottomSheet
          isOpen={open}
          onClose={() => setOpen(false)}
          title="Select Playbooks"
        >
          {playbookList(true)}
        </BottomSheet>
      </>
    );
  }

  // Desktop: use Popover
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn("multi-playbook-trigger", className)}
        disabled={disabled}
      >
        {triggerContent}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="multi-playbook-content"
          align="start"
          sideOffset={4}
          style={{
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            background: 'white',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            zIndex: 9999,
          }}
        >
          {playbookList(false)}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default MultiPlaybookSelect;
