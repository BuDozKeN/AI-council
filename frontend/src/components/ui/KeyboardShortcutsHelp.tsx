/**
 * KeyboardShortcutsHelp - Modal showing all available keyboard shortcuts
 *
 * Triggered by pressing ? key when not in an input field.
 */

import { useTranslation } from 'react-i18next';
import { AdaptiveModal } from './AdaptiveModal';
import { Keyboard } from 'lucide-react';
import './KeyboardShortcutsHelp.css';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

// Detect if user is on Mac for proper key labels
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string; description: string }[];
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: t('shortcuts.navigation', 'Navigation'),
      shortcuts: [
        { keys: `${modKey}+K`, description: t('shortcuts.focusSearch', 'Focus search / Open command palette') },
        { keys: `${modKey}+N`, description: t('shortcuts.newChat', 'Start new conversation') },
        { keys: `${modKey}+H`, description: t('shortcuts.openHistory', 'Open conversation history') },
        { keys: `${modKey}+L`, description: t('shortcuts.openLeaderboard', 'Open AI leaderboard') },
        { keys: `${modKey}+,`, description: t('shortcuts.openSettings', 'Open settings') },
      ],
    },
    {
      title: t('shortcuts.listNavigation', 'List Navigation'),
      shortcuts: [
        { keys: '↑ / ↓', description: t('shortcuts.navigateList', 'Navigate up/down in list') },
        { keys: 'Enter', description: t('shortcuts.selectItem', 'Select current item') },
        { keys: 'Delete', description: t('shortcuts.deleteItem', 'Delete current item') },
      ],
    },
    {
      title: t('shortcuts.general', 'General'),
      shortcuts: [
        { keys: 'Esc', description: t('shortcuts.escape', 'Close modal / Clear focus') },
        { keys: '?', description: t('shortcuts.showHelp', 'Show this help') },
      ],
    },
  ];

  return (
    <AdaptiveModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('shortcuts.title', 'Keyboard Shortcuts')}
      size="md"
      showCloseButton
    >
      <div className="shortcuts-help">
        <div className="shortcuts-header">
          <Keyboard className="shortcuts-icon" />
          <p className="shortcuts-hint">
            {t('shortcuts.hint', 'Use these shortcuts to navigate AxCouncil faster')}
          </p>
        </div>

        {shortcutGroups.map((group) => (
          <div key={group.title} className="shortcuts-group">
            <h3 className="shortcuts-group-title">{group.title}</h3>
            <div className="shortcuts-list">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.keys} className="shortcut-row">
                  <kbd className="shortcut-keys">{shortcut.keys}</kbd>
                  <span className="shortcut-desc">{shortcut.description}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="shortcuts-footer">
          <p>
            {t('shortcuts.pressToClose', 'Press')} <kbd>Esc</kbd> {t('shortcuts.orClickToClose', 'or click outside to close')}
          </p>
        </div>
      </div>
    </AdaptiveModal>
  );
}
