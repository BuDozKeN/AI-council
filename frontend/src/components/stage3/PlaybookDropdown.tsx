import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as Popover from '@radix-ui/react-popover';
import { BottomSheet } from '../ui/BottomSheet';
import { BookOpen, ChevronDown, ScrollText, Layers, FileText } from 'lucide-react';
import '../Stage3.css';

type DocType = 'sop' | 'framework' | 'policy' | '';
type SaveState = 'idle' | 'saving' | 'promoting' | 'saved' | 'promoted' | 'error';

const DOC_TYPE_OPTIONS = [
  {
    value: 'sop' as DocType,
    labelKey: 'stages.docTypes.sop' as const,
    descKey: 'stages.docTypes.sopDesc' as const,
    icon: ScrollText,
    colorClass: 'sop',
  },
  {
    value: 'framework' as DocType,
    labelKey: 'stages.docTypes.framework' as const,
    descKey: 'stages.docTypes.frameworkDesc' as const,
    icon: Layers,
    colorClass: 'framework',
  },
  {
    value: 'policy' as DocType,
    labelKey: 'stages.docTypes.policy' as const,
    descKey: 'stages.docTypes.policyDesc' as const,
    icon: FileText,
    colorClass: 'policy',
  },
];

// Check if we're on mobile/tablet
const isMobileDevice = () => window.innerWidth <= 768;

interface PlaybookDropdownProps {
  selectedDocType: string;
  setSelectedDocType: (type: string) => void;
  saveState: SaveState;
}

/**
 * PlaybookDropdown - Playbook type selection (SOP, Framework, Policy)
 * Uses Radix UI Popover for consistent positioning with other toolbar dropdowns
 */
export function PlaybookDropdown({
  selectedDocType,
  setSelectedDocType,
  saveState,
}: PlaybookDropdownProps) {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);

  const selectedOption = DOC_TYPE_OPTIONS.find((opt) => opt.value === selectedDocType);
  const isSaved = saveState === 'saved' || saveState === 'promoted';
  const isDisabled = saveState === 'saving' || saveState === 'promoting';

  // Get translated label and description for selected option
  const selectedLabel = selectedOption ? t(selectedOption.labelKey) : '';
  const selectedDesc = selectedOption ? t(selectedOption.descKey) : '';

  const handleSelect = (value: DocType) => {
    if (isSaved) return;
    setSelectedDocType(value);
    setShowDropdown(false);
  };

  const triggerContent = (
    <>
      {selectedOption ? (
        <>
          <selectedOption.icon className="h-3.5 w-3.5" />
          <span>{selectedLabel}</span>
        </>
      ) : (
        <>
          <BookOpen className="h-3.5 w-3.5" />
          <span>{t('context.playbooks')}</span>
        </>
      )}
      {!isSaved && <ChevronDown className="h-3 w-3" />}
    </>
  );

  const dropdownContent = (
    <>
      <div className="toolbar-dropdown-header">{t('stages.playbookType')}</div>
      <div className="toolbar-dropdown-list">
        {/* No type option */}
        <button
          className={`toolbar-dropdown-option playbook-option ${!selectedDocType ? 'selected' : ''}`}
          onClick={() => handleSelect('')}
        >
          <BookOpen className="h-4 w-4" />
          <div className="toolbar-dropdown-option-text">
            <span className="toolbar-dropdown-option-name">{t('stages.noType')}</span>
            <span className="toolbar-dropdown-option-desc">
              {t('stages.saveWithoutClassifying')}
            </span>
          </div>
        </button>

        {/* Type options */}
        {DOC_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              className={`toolbar-dropdown-option playbook-option ${option.colorClass} ${selectedDocType === option.value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              <Icon className="h-4 w-4" />
              <div className="toolbar-dropdown-option-text">
                <span className="toolbar-dropdown-option-name">{t(option.labelKey)}</span>
                <span className="toolbar-dropdown-option-desc">{t(option.descKey)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  // Mobile: use BottomSheet
  if (isMobileDevice()) {
    return (
      <div className="playbook-selector-inline">
        <button
          className={`toolbar-pill playbook-trigger-pill ${selectedOption ? `has-type ${selectedOption.colorClass}` : ''} ${isSaved && selectedOption ? 'saved' : ''}`}
          onClick={() => !isDisabled && !isSaved && setShowDropdown(true)}
          disabled={isDisabled}
          title={
            isSaved && selectedOption
              ? t('stages.savedAs', { type: selectedLabel })
              : selectedOption
                ? selectedDesc
                : t('stages.optionallyClassify')
          }
        >
          {triggerContent}
        </button>

        <BottomSheet
          isOpen={showDropdown}
          onClose={() => setShowDropdown(false)}
          title={t('stages.selectPlaybookType')}
        >
          <div className="toolbar-list-mobile">
            {/* No type option */}
            <button
              type="button"
              className={`toolbar-option-mobile playbook-option ${!selectedDocType ? 'selected' : ''}`}
              onClick={() => handleSelect('')}
            >
              <div className="toolbar-option-icon">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="toolbar-option-content">
                <span className="toolbar-option-name">{t('stages.noType')}</span>
                <span className="toolbar-option-desc">{t('stages.saveWithoutClassifying')}</span>
              </div>
            </button>

            {/* Type options */}
            {DOC_TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  type="button"
                  key={option.value}
                  className={`toolbar-option-mobile playbook-option ${option.colorClass} ${selectedDocType === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className={`toolbar-option-icon ${option.colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="toolbar-option-content">
                    <span className="toolbar-option-name">{t(option.labelKey)}</span>
                    <span className="toolbar-option-desc">{t(option.descKey)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </div>
    );
  }

  // Desktop: use Radix Popover for consistent positioning
  return (
    <div className="playbook-selector-inline">
      <Popover.Root
        open={showDropdown}
        onOpenChange={(open) => {
          if (!isSaved) setShowDropdown(open);
        }}
      >
        <Popover.Trigger
          className={`toolbar-pill playbook-trigger-pill ${selectedOption ? `has-type ${selectedOption.colorClass}` : ''} ${isSaved && selectedOption ? 'saved' : ''}`}
          disabled={isDisabled}
          title={
            isSaved && selectedOption
              ? t('stages.savedAs', { type: selectedLabel })
              : selectedOption
                ? selectedDesc
                : t('stages.optionallyClassify')
          }
        >
          {triggerContent}
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="toolbar-dropdown-portal playbook"
            align="start"
            sideOffset={4}
            collisionPadding={8}
          >
            {dropdownContent}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
