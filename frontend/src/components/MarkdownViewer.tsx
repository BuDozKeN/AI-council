import { useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { smartTextToMarkdown } from '../lib/smartTextToMarkdown';
import { makeClickable } from '../utils/a11y';
import './MarkdownViewer.css';

/**
 * Clean markdown content by removing redundant headers and metadata.
 *
 * Removes:
 * - Leading # titles (modal already shows the title)
 * - Blockquote metadata (> **Last Updated:** etc.)
 * - Leading horizontal rules (---)
 */
function cleanContent(content: string): string {
  if (!content) return content;

  let cleaned = content;

  // Remove leading # title line (e.g., "# Technology Department Context")
  cleaned = cleaned.replace(/^#\s+[^\n]+\n+/, '');

  // Remove leading blockquote metadata block (lines starting with >)
  // This handles:
  // > **Last Updated:** 2025-12-12
  // > **Organisation:** AxCouncil
  cleaned = cleaned.replace(/^(>\s*[^\n]*\n)+\n*/, '');

  // Remove leading horizontal rule
  cleaned = cleaned.replace(/^---+\n+/, '');

  // Trim any remaining leading whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * MarkdownViewer - Renders markdown content as clean, formatted HTML
 *
 * Uses Tailwind Typography plugin for beautiful prose styling.
 * Supports GitHub Flavored Markdown (tables, strikethrough, etc.)
 *
 * Features:
 * - Auto-converts plain text to Markdown (tables, headers, code blocks)
 * - Cleans up redundant metadata headers
 *
 * Props:
 * - content: The markdown or plain text string to render
 * - className: Additional CSS classes
 * - skipCleanup: Set to true to skip metadata removal (for raw editing preview)
 * - skipSmartConvert: Set to true to skip plain text to markdown conversion
 */

interface MarkdownViewerProps {
  content: string;
  className?: string | undefined;
  skipCleanup?: boolean | undefined;
  skipSmartConvert?: boolean | undefined;
}

export default function MarkdownViewer({
  content,
  className = '',
  skipCleanup = false,
  skipSmartConvert = false,
}: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle clicks on anchor links to scroll within the container (works in modals)
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const targetElement = e.target as HTMLElement;
    const target = targetElement.closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href || !href.startsWith('#')) return;

    e.preventDefault();
    const id = href.slice(1);
    const element = containerRef.current?.querySelector(`#${CSS.escape(id)}`);

    if (element) {
      // Find the scrollable parent (modal body or container)
      let scrollParent = element.parentElement;
      while (scrollParent && scrollParent !== document.body) {
        const style = getComputedStyle(scrollParent);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          break;
        }
        scrollParent = scrollParent.parentElement;
      }

      if (scrollParent && scrollParent !== document.body) {
        // Scroll within the modal/container
        const containerRect = scrollParent.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();
        const offsetTop = elementRect.top - containerRect.top + scrollParent.scrollTop;
        scrollParent.scrollTo({ top: offsetTop - 20, behavior: 'smooth' });
      } else {
        // Fallback to standard scroll
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, []);

  if (!content || content.trim() === '') {
    return <p className="text-gray-500 italic">No content yet.</p>;
  }

  // First, convert plain text to markdown if needed
  const processedContent = skipSmartConvert ? content : smartTextToMarkdown(content);

  // Then clean up redundant headers/metadata
  const displayContent = skipCleanup ? processedContent : cleanContent(processedContent);

  return (
    // eslint-disable-next-line react-hooks/rules-of-hooks
    <div
      ref={containerRef}
      className={`prose prose-slate prose-sm max-w-none ${className}`}
      {...makeClickable(handleClick)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={{
          // Wrap tables in a scrollable container for mobile
          table: ({ children, ...props }) => (
            <div className="table-scroll-wrapper">
              <table {...props}>{children}</table>
            </div>
          ),
        }}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  );
}
