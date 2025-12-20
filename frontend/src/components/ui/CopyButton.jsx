/**
 * CopyButton - Consistent icon-only copy button with checkmark feedback
 *
 * Usage:
 *   <CopyButton text={contentToCopy} />
 *   <CopyButton text={contentToCopy} position="sticky" /> // Sticky top-right
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import './CopyButton.css';

export function CopyButton({
  text,
  position = 'inline', // 'inline' | 'sticky' | 'absolute'
  size = 'md', // 'sm' | 'md' | 'lg'
  className = ''
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const sizeClasses = {
    sm: 'copy-btn-sm',
    md: 'copy-btn-md',
    lg: 'copy-btn-lg',
  };

  const positionClasses = {
    inline: '',
    sticky: 'copy-btn-sticky',
    absolute: 'copy-btn-absolute',
  };

  return (
    <button
      type="button"
      className={`copy-btn-unified ${sizeClasses[size]} ${positionClasses[position]} ${copied ? 'copied' : ''} ${className}`}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy'}
      aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
    >
      {copied ? (
        <Check className="copy-btn-icon" />
      ) : (
        <Copy className="copy-btn-icon" />
      )}
    </button>
  );
}

export default CopyButton;
