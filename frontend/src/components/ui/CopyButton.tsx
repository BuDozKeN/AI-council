/**
 * CopyButton - Hover-to-reveal copy button
 *
 * Best practice: Hidden by default, appears on parent hover.
 * Parent container needs class "copyable" for hover-reveal behavior.
 *
 * Usage:
 *   <div className="copyable">
 *     <CopyButton text={contentToCopy} />
 *     {content}
 *   </div>
 */

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { logger } from '../../utils/logger';
import './CopyButton.css';

interface CopyButtonProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
  className?: string;
}

export function CopyButton({
  text,
  size = 'md',
  inline = false,
  className = ''
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  const sizeClass = `copy-btn-${size}`;
  const inlineClass = inline ? 'copy-btn-inline' : '';

  return (
    <button
      type="button"
      className={`copy-btn-unified ${sizeClass} ${inlineClass} ${copied ? 'copied' : ''} ${className}`.trim()}
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
