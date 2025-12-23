/* eslint-disable react-refresh/only-export-components -- Exporting useContextMenu hook alongside component is intentional */
/**
 * ConversationContextMenu - Right-click context menu for conversation actions
 *
 * Features:
 * - All conversation actions accessible via right-click
 * - Keyboard accessible (Escape to close)
 * - Positioned near cursor
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Star, Archive, ArchiveRestore, Trash2, Copy, Download } from 'lucide-react';
import './ConversationContextMenu.css';

export function ConversationContextMenu({
  isOpen,
  position,
  conversation,
  onClose,
  onRename,
  onStar,
  onArchive,
  onDelete,
  onExport,
}) {
  const menuRef = useRef(null);

  // Close on Escape and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    // Delay touchstart listener to prevent immediate close on long-press trigger
    // The touch that triggered the menu is still active, so we need to wait
    const touchTimer = setTimeout(() => {
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      clearTimeout(touchTimer);
    };
  }, [isOpen, onClose]);

  // Adjust position to keep menu in viewport
  const _adjustedPosition = useCallback(() => {
    if (!menuRef.current) return position;

    const menuRect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let { x, y } = position;

    // Adjust horizontal position
    if (x + menuRect.width > window.innerWidth - padding) {
      x = window.innerWidth - menuRect.width - padding;
    }

    // Adjust vertical position
    if (y + menuRect.height > window.innerHeight - padding) {
      y = window.innerHeight - menuRect.height - padding;
    }

    return { x: Math.max(padding, x), y: Math.max(padding, y) };
  }, [position]);

  if (!isOpen || !conversation) return null;

  const menuItems = [
    {
      label: 'Rename',
      icon: Pencil,
      onClick: () => {
        onRename(conversation);
        onClose();
      },
    },
    {
      label: conversation.is_starred ? 'Remove star' : 'Add star',
      icon: Star,
      onClick: () => {
        onStar(conversation.id, !conversation.is_starred);
        onClose();
      },
      className: conversation.is_starred ? 'starred' : '',
    },
    { type: 'separator' },
    {
      label: conversation.is_archived ? 'Unarchive' : 'Archive',
      icon: conversation.is_archived ? ArchiveRestore : Archive,
      onClick: () => {
        onArchive(conversation.id, !conversation.is_archived);
        onClose();
      },
    },
    ...(onExport ? [{
      label: 'Export',
      icon: Download,
      onClick: () => {
        onExport(conversation.id);
        onClose();
      },
    }] : []),
    { type: 'separator' },
    {
      label: 'Delete',
      icon: Trash2,
      onClick: () => {
        onDelete(conversation.id);
        onClose();
      },
      className: 'danger',
    },
  ];

  const menu = (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: position.x,
        top: position.y,
      }}
      role="menu"
      aria-label="Conversation actions"
    >
      {menuItems.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={index} className="context-menu-separator" role="separator" />;
        }

        const Icon = item.icon;
        return (
          <button
            key={item.label}
            className={`context-menu-item ${item.className || ''}`}
            onClick={item.onClick}
            role="menuitem"
          >
            <Icon size={14} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(menu, document.body);
}

/**
 * useContextMenu - Hook for managing context menu state
 */
export function useContextMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [contextData, setContextData] = useState(null);

  const open = useCallback((e, data) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setContextData(data);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setContextData(null);
  }, []);

  return {
    isOpen,
    position,
    contextData,
    open,
    close,
  };
}
