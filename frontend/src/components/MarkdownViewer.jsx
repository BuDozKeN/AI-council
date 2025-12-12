import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
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
 * Props:
 * - content: The markdown string to render
 * - className: Additional CSS classes
 * - skipCleanup: Set to true to skip metadata removal (for raw editing preview)
 */
export default function MarkdownViewer({ content, className = '', skipCleanup = false }) {
  if (!content || content.trim() === '') {
    return <p className="text-gray-500 italic">No content yet.</p>;
  }

  const displayContent = skipCleanup ? content : cleanContent(content);

  return (
    <div className={`prose prose-slate prose-sm max-w-none ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]}>
        {displayContent}
      </ReactMarkdown>
    </div>
  );
}
