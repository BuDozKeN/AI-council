import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strip markdown formatting from text for clean display.
 * Useful for showing descriptions or summaries without markdown noise.
 */
export function stripMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return (
    text
      // Remove headers (### Header)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold (**text** or __text__)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      // Remove italic (*text* or _text_)
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Remove markdown tables (|---|---|)
      .replace(/\|[-:]+\|[-:|\s]+\|/g, '')
      // Clean up table rows but keep content
      .replace(/^\|(.+)\|$/gm, (_match: string, content: string) => {
        return content
          .split('|')
          .map((s: string) => s.trim())
          .filter((s: string) => s)
          .join(' - ');
      })
      // Convert markdown bullets to plain text (no bullets for summaries)
      .replace(/^[-*+]\s+/gm, '')
      // Remove numbered list markers
      .replace(/^\d+\.\s+/gm, '')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`(.+?)`/g, '$1')
      // Remove links but keep text [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Clean up extra whitespace
      .replace(/\n{2,}/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/**
 * Truncate text to a maximum length, adding ellipsis if needed.
 */
export function truncateText(text: string | null | undefined, maxLength: number = 150): string {
  if (!text) return '';
  const stripped = stripMarkdown(text);
  if (stripped.length <= maxLength) return stripped;
  return stripped.slice(0, maxLength).trim() + '...';
}
