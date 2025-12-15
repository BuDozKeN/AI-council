import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { smartTextToMarkdown } from '../lib/smartTextToMarkdown';
import './MarkdownViewer.css';

/**
 * Clean markdown content by removing redundant headers and metadata.
 *
 * Removes:
 * - Leading # titles (modal already shows the title)
 * - Blockquote metadata (> **Last Updated:** etc.)
 * - Leading horizontal rules (---)
 */
function cleanContent(content) {
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
export default function MarkdownViewer({ content, className = '', skipCleanup = false, skipSmartConvert = false }) {
  if (!content || content.trim() === '') {
    return <p className="text-gray-500 italic">No content yet.</p>;
  }

  // First, convert plain text to markdown if needed
  let processedContent = skipSmartConvert ? content : smartTextToMarkdown(content);

  // Then clean up redundant headers/metadata
  const displayContent = skipCleanup ? processedContent : cleanContent(processedContent);

  return (
    <div className={`prose prose-slate prose-sm max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {displayContent}
      </ReactMarkdown>
    </div>
  );
}
