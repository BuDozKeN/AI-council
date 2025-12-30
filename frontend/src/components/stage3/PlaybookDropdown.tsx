import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet } from '../ui/BottomSheet';
import { BookOpen, ChevronDown, ScrollText, Layers, FileText, LucideIcon } from 'lucide-react';
import '../Stage3.css';

type DocType = 'sop' | 'framework' | 'policy' | '';
type SaveState = 'idle' | 'saving' | 'promoting' | 'saved' | 'promoted' | 'error';

interface DocTypeOption {
  value: DocType;
  label: string;
  icon: LucideIcon;
  description: string;
  colorClass: string;
}

const DOC_TYPE_OPTIONS: DocTypeOption[] = [
  {
    value: 'sop',
    label: 'SOP',
    icon: ScrollText,
    description: 'Standard Operating Procedure',
    colorClass: 'sop'
  },
  {
    value: 'framework',
    label: 'Framework',
    icon: Layers,
    description: 'Guidelines and best practices',
    colorClass: 'framework'
  },
  {
    value: 'policy',
    label: 'Policy',
    icon: FileText,
    description: 'Rules and requirements',
    colorClass: 'policy'
  }
];

// Check if we're on mobile/tablet
const isMobileDevice = () => window.innerWidth <= 768;

// Dropdown height estimate
const DROPDOWN_HEIGHT = 280;

interface PlaybookDropdownProps {
  selectedDocType: string;
  setSelectedDocType: (type: string) => void;
  saveState: SaveState;
}

/**
 * PlaybookDropdown - Playbook type selection (SOP, Framework, Policy)
 * Uses unified toolbar dropdown system for consistency
 */
export function PlaybookDropdown({
  selectedDocType,
  setSelectedDocType,
  saveState
}: PlaybookDropdownProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const selectedOption = DOC_TYPE_OPTIONS.find(opt => opt.value === selectedDocType);
  const isSaved = saveState === 'saved' || saveState === 'promoted';
  const isDisabled = saveState === 'saving' || saveState === 'promoting';

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const portalDropdown = document.querySelector('.toolbar-dropdown-portal.playbook');
        if (!portalDropdown || !portalDropdown.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleSelect = (value: DocType) => {
    if (isSaved) return;
    setSelectedDocType(value);
    setShowDropdown(false);
  };

  const openDropdown = () => {
    if (isSaved || isDisabled) return;

    if (!showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;

      if (spaceBelow < DROPDOWN_HEIGHT && rect.top > spaceBelow) {
        setDropdownPosition({
          top: rect.top - DROPDOWN_HEIGHT - 4,
          left: rect.left
        });
      } else {
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left
        });
      }
    }
    setShowDropdown(!showDropdown);
  };

  return (
    <div className="playbook-selector-inline">
      <button
        ref={buttonRef}
        className={`toolbar-pill playbook-trigger-pill ${selectedOption ? `has-type ${selectedOption.colorClass}` : ''} ${isSaved && selectedOption ? 'saved' : ''}`}
        onClick={openDropdown}
        disabled={isDisabled}
        title={
          isSaved && selectedOption
            ? `Saved as ${selectedOption.label}`
            : selectedOption
              ? selectedOption.description
              : 'Optionally classify as a playbook type'
        }
      >
        {selectedOption ? (
          <>
            <selectedOption.icon className="h-3.5 w-3.5" />
            <span>{selectedOption.label}</span>
          </>
        ) : (
          <>
            <BookOpen className="h-3.5 w-3.5" />
            <span>Playbook</span>
          </>
        )}
        {!isSaved && <ChevronDown className="h-3 w-3" />}
      </button>

      {/* Mobile: BottomSheet */}
      {showDropdown && isMobileDevice() ? (
        <BottomSheet
          isOpen={showDropdown}
          onClose={() => setShowDropdown(false)}
          title="Select Playbook Type"
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
                <span className="toolbar-option-name">No Type</span>
                <span className="toolbar-option-desc">Save without classifying</span>
              </div>
            </button>

            {/* Type options */}
            {DOC_TYPE_OPTIONS.map(option => {
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
                    <span className="toolbar-option-name">{option.label}</span>
                    <span className="toolbar-option-desc">{option.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      ) : showDropdown && createPortal(
        <div
          className="toolbar-dropdown-portal playbook"
          style={{
            top: Math.max(8, dropdownPosition.top),
            left: dropdownPosition.left,
          }}
        >
          <div className="toolbar-dropdown-header">Playbook Type</div>
          <div className="toolbar-dropdown-list">
            {/* No type option */}
            <button
              className={`toolbar-dropdown-option playbook-option ${!selectedDocType ? 'selected' : ''}`}
              onClick={() => handleSelect('')}
            >
              <BookOpen className="h-4 w-4" />
              <div className="toolbar-dropdown-option-text">
                <span className="toolbar-dropdown-option-name">No Type</span>
                <span className="toolbar-dropdown-option-desc">Save without classifying</span>
              </div>
            </button>

            {/* Type options */}
            {DOC_TYPE_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  className={`toolbar-dropdown-option playbook-option ${option.colorClass} ${selectedDocType === option.value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option.value)}
                >
                  <Icon className="h-4 w-4" />
                  <div className="toolbar-dropdown-option-text">
                    <span className="toolbar-dropdown-option-name">{option.label}</span>
                    <span className="toolbar-dropdown-option-desc">{option.description}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
